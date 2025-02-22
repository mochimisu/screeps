import { readCellFromSerializedGrid4 } from "utils/compact-grid";
import {
  defendersByDefenseArea,
  DefenseQuadrantStatus,
  getMemoryDefense,
  rampartDefenderMeleeParts,
  rampartDefenderRangedParts,
  rampartDefenderRepairerParts,
  roamingDefenderMeleeParts,
  roamingDefenderRangedParts
} from "./defense";
import { calcStrat } from "./scripts";
import { creepsByRole, creepsByRoomAssignmentAndRole, query } from "utils/query";
import { DefenderMeleeCreep, DefenderRangedCreep, DefenderRepairerCreep, isDefender } from "./role.defenders.type";
import { getAllRoomNames } from "manager/room";
import { creepDps, creepHps } from "utils/combat";
import { spawnInRoom } from "manager/spawn";
import { defenderMeleeLoop } from "./role.defender-melee";
import { defenderRepairerLoop } from "./role.defender-repairer";
import { defenderRangedLoop } from "./role.defender-ranged";
import { isEssDistributor } from "site/energy-storage-site/role.ess-distributor.type";
import { getSitesByRoom } from "site/energy-storage-site/site";

function rampartLoop(roomName: string) {
  const memory = getMemoryDefense();
  const room = Game.rooms[roomName];
  if (!room) {
    return;
  }
  const strategy = memory.strategy[roomName];
  if (strategy.type !== "base-rampart") {
    return;
  }
  // Find all hostile creeps in the area, and figure outh which defense area they are in
  const enemyByDefenseArea: { [defenseAreaIndex: number]: Creep[] } = {};
  const defenseAreaMatrixStr = strategy.defenseAreaMatrix;
  for (const enemy of room.find(FIND_HOSTILE_CREEPS)) {
    const defenseArea = readCellFromSerializedGrid4(defenseAreaMatrixStr, enemy.pos.x, enemy.pos.y) - 1;
    if (defenseArea >= 0) {
      if (enemyByDefenseArea[defenseArea] == null) {
        enemyByDefenseArea[defenseArea] = [];
      }
      enemyByDefenseArea[defenseArea].push(enemy);
    }
  }
  if (Object.keys(enemyByDefenseArea).length === 0) {
    // No enemies, no need to do anything
    return;
  }

  for (let i = 0; i < strategy.defenseAreas.length; i++) {
    const enemies = enemyByDefenseArea[i] || [];
    const defenders = defendersByDefenseArea(roomName, i);
    const status: DefenseQuadrantStatus = {
      numEnemies: enemies.length,
      enemyDPSTotal: enemies.reduce((acc, enemy) => {
        return acc + creepDps(enemy);
      }, 0),
      enemyHPSTotal: enemies.reduce((acc, enemy) => {
        return acc + creepHps(enemy);
      }, 0),
      enemyHealthTotal: enemies.reduce((acc, enemy) => {
        return acc + enemy.hits;
      }, 0),
      creepDPS: defenders.reduce((acc, defender) => {
        return acc + creepDps(defender);
      }, 0)
    };
    if (memory.baseDefenseStatus[roomName] == null) {
      memory.baseDefenseStatus[roomName] = {};
    }
    memory.baseDefenseStatus[roomName][i] = status;
    if (status.numEnemies === 0) {
      continue;
    }
    let shouldSpawn = true;
    if (status.enemyHPSTotal === 0 && status.numEnemies <= 2) {
      //towers can handle this
      shouldSpawn = false;
    }
    if (Game.time % 10 === 0) {
      console.log("Enemies in room " + roomName + ": " + JSON.stringify(enemyByDefenseArea) + "@" + Game.time);
      if (!shouldSpawn) {
        console.log(`  zone:${i}: handling with towers...`);
      }
      console.log(
        `  zone:${i}: ${status.numEnemies} enemies, ${status.enemyDPSTotal} DPS, ${status.enemyHPSTotal} HPS`
      );
      console.log(`             ${defenders.length} defenders, ${status.creepDPS} DPS`);
    }
    if (!shouldSpawn) {
      continue;
    }
    // TODO probably share this fn/spawn
    // Spawn an addition wartime ESS distributor
    const wartimeEssDistributors = creepsByRole("ess-distributor").filter(
      c => isEssDistributor(c) && c.memory.roomName === roomName && c.memory.wartime
    );
    if (wartimeEssDistributors.length < 2) {
      // Find ess site name
      for (const site of getSitesByRoom(roomName)) {
        spawnInRoom("ess-distributor", {
          roomName,
          assignToRoom: true,
          parts: site.distributorParts ?? [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
          additionalMemory: { essSiteName: site.name, wartime: true },
          spawnElsewhereIfNeeded: true
        });
      }
    }
    if (status.creepDPS < status.enemyHPSTotal) {
      // We need more creeps to be able to defend
      // If we do not have a melee defender, spawn one
      const meleeDefenders = defenders.filter(c => c.memory.role === "defender-melee") as DefenderMeleeCreep[];
      const numMeleeDefenders = meleeDefenders.length;
      if (numMeleeDefenders === 0) {
        spawnInRoom("defender-melee", {
          roomName,
          assignToRoom: true,
          parts: rampartDefenderMeleeParts,
          additionalMemory: { defenseAreaIndex: i, slotIndex: 0 },
          spawnElsewhereIfNeeded: true
        });
        continue;
      }
      // Spawn ranged defenders to fill the number of ranged spots
      const rangedDefenders = defenders.filter(c => c.memory.role === "defender-ranged") as DefenderRangedCreep[];
      const numRangedDefenders = rangedDefenders.length;
      const usedSlots = new Set(rangedDefenders.map(c => c.memory.slotIndex));
      if (numRangedDefenders < strategy.defenseAreas[i].rampartRanged.length) {
        // Find an open slot
        let slotIndex = 0;
        while (usedSlots.has(slotIndex)) {
          slotIndex++;
        }
        spawnInRoom("defender-ranged", {
          roomName,
          assignToRoom: true,
          parts: rampartDefenderRangedParts,
          spawnElsewhereIfNeeded: true,
          additionalMemory: { defenseAreaIndex: i, slotIndex }
        });
        continue;
      }
      // Spawn melee defenders to fill the number of melee spots
      if (numMeleeDefenders < strategy.defenseAreas[i].rampartMelee.length) {
        // Find an open slot
        let slotIndex = 0;
        while (usedSlots.has(slotIndex)) {
          slotIndex++;
        }
        spawnInRoom("defender-melee", {
          roomName,
          assignToRoom: true,
          parts: rampartDefenderMeleeParts,
          spawnElsewhereIfNeeded: true,
          additionalMemory: { defenseAreaIndex: i, slotIndex }
        });
        continue;
      }
    }
    // Spawn 1 repairer for every 4 enemies
    const repairers = defenders.filter(c => c.memory.role === "defender-repairer");
    const numRepairers = repairers.length;
    if (numRepairers < Math.floor(enemies.length / 4)) {
      spawnInRoom("defender-repairer", {
        roomName,
        assignToRoom: true,
        parts: rampartDefenderRepairerParts,
        spawnElsewhereIfNeeded: true,
        additionalMemory: { defenseAreaIndex: i }
      });
    }
  }
}

function roamingRemoteSimpleLoop(roomName: string) {
  // Make sure we have the number of defenders we need
  const strategy = getMemoryDefense().strategy[roomName];
  if (strategy.type !== "roaming-remote-simple") {
    return;
  }
  const numDesiredMelee = strategy.numMeleeDefenders || 1;
  const numDesiredRanged = strategy.numRangedDefenders || 0;
  // Count the number of defenders we have
  const defenders = creepsByRoomAssignmentAndRole(roomName, "defender-melee");
  const numMelee = defenders.length;
  const defendersRanged = creepsByRoomAssignmentAndRole(roomName, "defender-ranged");
  const numRanged = defendersRanged.length;
  if (numMelee < numDesiredMelee) {
    spawnInRoom("defender-melee", {
      roomName,
      assignToRoom: true,
      spawnElsewhereIfNeeded: true,
      parts: roamingDefenderMeleeParts
    });
    return;
  }
  if (numRanged < numDesiredRanged) {
    spawnInRoom("defender-ranged", {
      roomName,
      assignToRoom: true,
      spawnElsewhereIfNeeded: true,
      parts: roamingDefenderRangedParts
    });
    return;
  }
}

export function defenseLoop() {
  const memory = getMemoryDefense();
  // For every room, if there is no defense strategy, calculate one.
  // (once per tick)
  // (they will be normally be manually calculated, because it is expensive)
  for (const roomName of getAllRoomNames()) {
    if (memory.strategy[roomName] == null) {
      calcStrat(roomName);
      return;
    }
  }

  // For every enemy, determine which defense area it is in, and figure out the DPS and HPS of the enemy.
  for (const roomName of getAllRoomNames()) {
    const room = Game.rooms[roomName];
    if (!room) {
      continue;
    }
    const strategy = memory.strategy[roomName];
    if (strategy.type === "base-rampart") {
      rampartLoop(roomName);
    } else if (strategy.type === "roaming-remote-simple") {
      roamingRemoteSimpleLoop(roomName);
    }
  }

  // creep loops
  for (const defender of creepsByRole("defender-melee")) {
    defenderMeleeLoop(defender as DefenderMeleeCreep);
  }
  for (const defender of creepsByRole("defender-ranged")) {
    defenderRangedLoop(defender as DefenderRangedCreep);
  }
  for (const defender of creepsByRole("defender-repairer")) {
    defenderRepairerLoop(defender as DefenderRepairerCreep);
  }
}
