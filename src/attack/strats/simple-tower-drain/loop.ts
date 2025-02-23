import { moveToIdleSpot } from "manager/idle";
import { spawnInRoom } from "manager/spawn";
import { ephemeral } from "screeps-clockwork";
import { ExitDirection } from "screeps-clockwork/dist/src/wasm/screeps_clockwork";
import { bodyPart } from "utils/body-part";
import { getAdjustedTerrainCostMatrix, getClockworkFlowMap } from "utils/clockwork";
import { Grid8Bit } from "utils/compact-grid";
import { creepsByRole, creepsByRoomAssignmentAndRole } from "utils/query";
import { atdAttackerLoop } from "./role.atd-attacker";
import {
  AttackTowerDrainAttackerCreep,
  AttackTowerDrainDismantlerCreep,
  AttackTowerDrainHealerCreep
} from "./role.type";
import { atdDismantlerLoop } from "./role.atd-dismantler";
import { atdHealerLoop } from "./role.atd-healer";
import { rampartHealthsRelative, rampartPath, scoutTerrain, tankMoveMap, towerDpsMap } from "./simple-tower-drain";
import { mainRoom } from "manager/room";
import { isEssDistributor } from "site/energy-storage-site/role.ess-distributor.type";
import { getSitesByRoom } from "site/energy-storage-site/site";

export function towerDrainCreepLoop() {
  const atdAttackers = creepsByRole("atd-attacker");
  for (const creep of atdAttackers) {
    atdAttackerLoop(creep as AttackTowerDrainAttackerCreep);
  }
  const atdHealers = creepsByRole("atd-healer");
  for (const creep of atdHealers) {
    atdHealerLoop(creep as AttackTowerDrainHealerCreep);
  }
  const atdDismantlers = creepsByRole("atd-dismantler");
  for (const creep of atdDismantlers) {
    atdDismantlerLoop(creep as AttackTowerDrainDismantlerCreep);
  }
}

export function towerDrainLoop(roomName: string) {
  const strategy = Memory.attack[roomName];
  if (strategy?.type !== "simple-tower-drain") {
    return;
  }
  if (strategy.status == null) {
    Memory.attack[roomName].status = { phase: "scout" };
    return;
  }

  if (strategy.status.phase === "scout") {
    // If we have visibility into the room, record and transition to prep
    const room = Game.rooms[roomName];
    if (room == null) {
      // Spawn a scout and wait for it to get there.
      const existingScouts = creepsByRoomAssignmentAndRole(roomName, "scout-single");
      if (existingScouts.length === 0) {
        spawnInRoom("scout-single", {
          roomName,
          assignToRoom: true,
          parts: [MOVE],
          spawnElsewhereIfNeeded: true
        });
      }
      return;
    } else {
      const scoutedTerrain = scoutTerrain(room);
      const towerPositions = room
        .find(FIND_HOSTILE_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_TOWER
        })
        .map(s => s.pos);
      const roomExit = room.findExitTo(strategy.fromRoom);
      const roomExitPos = roomExit != ERR_NO_PATH && roomExit != ERR_INVALID_ARGS && room.find(roomExit)[0];
      const rampartHealths = rampartHealthsRelative(room);
      const targetRamparts = roomExitPos && rampartPath(scoutedTerrain, rampartHealths, towerPositions, roomExitPos);
      // update memory
      strategy.scoutedTerrain = scoutedTerrain;
      strategy.towerPositions = towerPositions;
      strategy.rampartHealthsRelative = rampartHealths;
      strategy.targetRamparts = targetRamparts || [];
      strategy.status = { phase: "plan" };
      console.log("Scouted terrain and tower positions for " + roomName);
      return;
    }
  }
  if (strategy.status.phase === "plan") {
    // Read the scouted terrain and tower positions
    if (strategy.scoutedTerrain == null || strategy.towerPositions == null) {
      strategy.status = { phase: "scout" };
      console.log("ERROR: Missing scouted terrain or tower positions for " + roomName);
      return;
    }
    // Determine tower dps per location
    strategy.towerDpsMap = towerDpsMap(strategy.scoutedTerrain, strategy.towerPositions);
    // Look for movement path on edge that will drain tower at minimum DPS
    const tMap = tankMoveMap(strategy.towerDpsMap, strategy.fromDirection);
    if (tMap == null) {
      console.log("Could not find safe drain tower path for " + roomName);
      strategy.status = { phase: "inspect" };
    } else {
      strategy.tankMoveMap = tMap;
      strategy.status = { phase: "prep" };
      return;
    }
  }
  if (
    strategy.status.phase === "prep" ||
    strategy.status.phase === "drain" ||
    strategy.status.phase === "dismantle" ||
    strategy.status.phase === "attack"
  ) {
    // Give main spawn a wartime ess distributor
    const wartimeEssDistributors = creepsByRole("ess-distributor").filter(
      c => c.memory.roomName === mainRoom && isEssDistributor(c) && c.memory.wartime
    );
    if (wartimeEssDistributors.length < 1) {
      // Find ess site name
      for (const site of getSitesByRoom(mainRoom)) {
        spawnInRoom("ess-distributor", {
          roomName: mainRoom,
          assignToRoom: true,
          parts: site.distributorParts ?? [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
          additionalMemory: { essSiteName: site.name, wartime: true },
          spawnElsewhereIfNeeded: true
        });
      }
    }
    // For this, we need to spawn
    // 3 healers with >=120 HPS, 1000+ health
    // 2 ranged attackers with 2000 health, 40 dps (4 ranged_attack)
    // 1 dismantler with 1000 health, 4 work parts
    const healers = creepsByRoomAssignmentAndRole(roomName, "atd-healer");
    const attackers = creepsByRoomAssignmentAndRole(roomName, "atd-attacker");
    const dismantlers = creepsByRoomAssignmentAndRole(roomName, "atd-dismantler");
    if (healers.length < 4) {
      // console.log("[atd] trying to spawn healer...");
      spawnInRoom("atd-healer", {
        roomName,
        assignToRoom: true,
        spawnElsewhereIfNeeded: true,
        parts: [...bodyPart(TOUGH, 10), ...bodyPart(HEAL, 14), ...bodyPart(MOVE, 12)]
      });
      return;
    }
    // execute if we have the 3 healers near the rally spot we need
    if (strategy.status.phase === "prep") {
      if (strategy.rallyId) {
        const rally = Game.flags[strategy.rallyId];
        if (rally == null) {
          console.log("ERROR: Rally flag not found for " + roomName);
          strategy.status = { phase: "inspect" };
          return;
        }
        const creeps = creepsByRoomAssignmentAndRole(roomName, "atd-healer");
        let allNear = true;
        for (const creep of creeps) {
          if (creep.pos.getRangeTo(rally) > 2) {
            allNear = false;
            break;
          }
        }
        if (allNear) {
          strategy.status = { phase: "drain" };
        }
      }
    }
    if (attackers.length < 3) {
      spawnInRoom("atd-attacker", {
        roomName,
        assignToRoom: true,
        spawnElsewhereIfNeeded: true,
        parts: [...bodyPart(TOUGH, 20), ...bodyPart(RANGED_ATTACK, 4), ...bodyPart(MOVE, 24)]
      });
      return;
    }
    if (dismantlers.length < 1) {
      spawnInRoom("atd-dismantler", {
        roomName,
        assignToRoom: true,
        spawnElsewhereIfNeeded: true,
        parts: [...bodyPart(TOUGH, 10), ...bodyPart(WORK, 4), ...bodyPart(MOVE, 14)]
      });
      return;
    }
  }
  if (strategy.status.phase === "drain") {
    const healers = creepsByRoomAssignmentAndRole(roomName, "atd-healer");
    if (healers.length < 4) {
      // Go back to prep if we lose a healer
      console.log("Lost a healer in " + roomName);
      strategy.status = { phase: "prep" };
      return;
    }
    const room = Game.rooms[roomName];
    if (room == null) {
      return;
    }
    const enemyTowers = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    });
    const towerEnergy = enemyTowers.reduce((acc, t) => acc + t.store.getUsedCapacity(RESOURCE_ENERGY), 0);
    if (towerEnergy === 0) {
      strategy.status = { phase: "attack" };
      return;
    }
  }
  if (strategy.status.phase === "attack") {
    const room = Game.rooms[roomName];
    if (room == null) {
      return;
    }
    if (room.find(FIND_HOSTILE_CREEPS).length === 0) {
      strategy.status = { phase: "dismantle" };
      return;
    }
  }
  if (strategy.status.phase === "dismantle") {
    const room = Game.rooms[roomName];
    const enemyTowers = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    });
    const towerEnergy = enemyTowers.reduce((acc, t) => acc + t.store.getUsedCapacity(RESOURCE_ENERGY), 0);
    if (towerEnergy > 400) {
      // go back to drain
      strategy.status = { phase: "drain" };
    }
    // if there are no enemy structures, we're done
    const enemyStructures = room.find(FIND_HOSTILE_STRUCTURES);
    if (enemyStructures.length === 1) {
      // controller
      strategy.status = { phase: "complete" };
      return;
    }
  }
}
