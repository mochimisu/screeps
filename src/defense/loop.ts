import { readCellFromSerializedGrid4 } from "utils/compact-grid";
import { DefenseQuadrantStatus } from "./defense";
import { calcStrat } from "./scripts";
import { creepsByRoomAssignmentAndRole, query } from "utils/query";
import { isDefender } from "./role.defenders.type";

function defendersByDefenseArea(roomName: string, defenseAreaIndex: number): Creep[] {
  return query(
    `defendersByDefenseArea-${roomName}-${defenseAreaIndex}`,
    () => {
      const meleeDefenders = creepsByRoomAssignmentAndRole(roomName, "defender-melee");
      const rangedDefenders = creepsByRoomAssignmentAndRole(roomName, "defender-ranged");
      const repairerDefenders = creepsByRoomAssignmentAndRole(roomName, "defender-repairer");
      return meleeDefenders
        .concat(rangedDefenders)
        .concat(repairerDefenders)
        .filter(creep => {
          if (isDefender(creep)) {
            return creep.memory.defenseAreaIndex === defenseAreaIndex;
          }
          return false;
        });
    },
    1
  );
}

function creepDps(creep: Creep): number {
  return Math.max(
    creep.getActiveBodyparts(ATTACK) * ATTACK_POWER,
    creep.getActiveBodyparts(RANGED_ATTACK) * RANGED_ATTACK_POWER
  );
}

function creepHps(creep: Creep): number {
  return creep.getActiveBodyparts(HEAL) * HEAL_POWER;
}

export function defenseLoop() {
  // For every room, if there is no defense strategy, calculate one.
  // (once per tick)
  // (they will be normally be manually calculated, because it is expensive)
  for (const roomName in Game.rooms) {
    if (Memory.defense[roomName] == null) {
      calcStrat(roomName);
      return;
    }
  }

  // For every enemy, determine which defense area it is in, and figure out the DPS and HPS of the enemy.
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    if (!room) {
      continue;
    }
    const strategy = Memory.defense[roomName];
    if (strategy.type === "base-rampart") {
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
        Memory.baseDefenseStatus[roomName][i] = status;
      }
    }
  }
}
