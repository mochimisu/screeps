import { bodyPart } from "utils/body-part";
import { creepsByRoomAssignmentAndRole, query, queryCostMatrix } from "utils/query";
import { isDefender } from "./role.defenders.type";
import { Grid4Bit } from "utils/compact-grid";

export const rampartDefenderMeleeParts: BodyPartConstant[] = [
  ...bodyPart(TOUGH, 10),
  ...bodyPart(ATTACK, 8),
  ...bodyPart(MOVE, 9)
];
export const rampartDefenderRangedParts: BodyPartConstant[] = [
  ...bodyPart(TOUGH, 10),
  ...bodyPart(RANGED_ATTACK, 5),
  ...bodyPart(MOVE, 8)
];
export const rampartDefenderRepairerParts: BodyPartConstant[] = [
  ...bodyPart(TOUGH, 10),
  ...bodyPart(WORK, 4),
  ...bodyPart(CARRY, 4),
  ...bodyPart(MOVE, 9)
];

export const roamingDefenderMeleeParts: BodyPartConstant[] = [
  ...bodyPart(TOUGH, 15),
  ...bodyPart(ATTACK, 5),
  ...bodyPart(MOVE, 20)
];
export const roamingDefenderRangedParts: BodyPartConstant[] = [
  ...bodyPart(TOUGH, 15),
  ...bodyPart(RANGED_ATTACK, 5),
  ...bodyPart(MOVE, 20)
];

export type RampartDefenseArea = {
  rampartMelee: RoomPosition[];
  rampartRanged: RoomPosition[];
};

export type DefenseStrategy =
  | {
      type: "roaming-remote-simple";
      idleSpot?: RoomPosition;
      numMeleeDefenders?: number;
      numRangedDefenders?: number;
    }
  | {
      type: "base-rampart";
      roomName: string;
      defenseAreas: RampartDefenseArea[];
      defenseAreaMatrix: string;
    };

export type DefenseQuadrantStatus = {
  numEnemies: number;
  enemyDPSTotal: number;
  enemyHPSTotal: number;
  enemyHealthTotal: number;
  creepDPS: number;
};

declare global {
  interface Memory {
    defense: {
      strategy: {
        [roomName: string]: DefenseStrategy;
      };
      baseDefenseStatus: {
        [roomName: string]: {
          [defenseAreaIndex: number]: DefenseQuadrantStatus;
        };
      };
    };
  }
}

export function getMemoryDefense() {
  if (Memory.defense == null) {
    Memory.defense = { strategy: {}, baseDefenseStatus: {} };
  }
  return Memory.defense;
}

export function defendersByDefenseArea(roomName: string, defenseAreaIndex: number): Creep[] {
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

export function defenderSafeAreaMatrix(roomName: string): CostMatrix {
  return queryCostMatrix(
    `defense-defenderSafeAreaMatrix-${roomName}`,
    () => {
      const costMatrix = new PathFinder.CostMatrix();
      // Fill with walls and ramparts
      const room = Game.rooms[roomName];
      if (!room) {
        return costMatrix;
      }
      const terrain = room.getTerrain();
      for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
          if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
            costMatrix.set(x, y, 2);
          }
        }
      }
      const walls = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_WALL
      });
      for (const wall of walls) {
        costMatrix.set(wall.pos.x, wall.pos.y, 2);
      }

      // Find the defense matrix for this area
      const strategy = getMemoryDefense().strategy[roomName];
      if (strategy.type === "base-rampart") {
        const defenseAreaMatrixStr = strategy.defenseAreaMatrix;
        const grid4 = Grid4Bit.fromSerialized(defenseAreaMatrixStr);
        for (let x = 0; x < 50; x++) {
          for (let y = 0; y < 50; y++) {
            if (grid4.get(x, y) !== 0) {
              costMatrix.set(x, y, 255);
            }
          }
        }
      }
      return costMatrix;
    },
    100
  );
}

export function bfsUntilRampart(
  roomName: string,
  start: RoomPosition
): {
  result: RoomPosition[];
  ramparts: RoomPosition[];
} {
  const rwMtx = rampartWallMatrix(roomName);
  const visited = new Set<string>();
  const queue = [start];
  const result = [];
  const ramparts = [];
  const seenRamparts = new Set<string>();
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (visited.has(current.toString())) {
      continue;
    }
    visited.add(current.toString());
    const mtxVal = rwMtx.get(current.x, current.y);
    if (mtxVal === 1) {
      if (seenRamparts.has(current.toString())) {
        continue;
      }
      ramparts.push(current);
      seenRamparts.add(current.toString());
      continue;
    } else if (mtxVal === 2) {
      continue;
    }
    result.push(current);
    const newPositions = [
      [current.x - 1, current.y],
      [current.x + 1, current.y],
      [current.x, current.y - 1],
      [current.x, current.y + 1],
      [current.x - 1, current.y - 1],
      [current.x + 1, current.y + 1],
      [current.x - 1, current.y + 1],
      [current.x + 1, current.y - 1]
    ]
      .filter(p => p[0] >= 0 && p[0] < 50 && p[1] >= 0 && p[1] < 50)
      .map(p => new RoomPosition(p[0], p[1], roomName));
    queue.push(...newPositions);
  }

  return {
    result,
    ramparts
  };
}
export function rampartCostMatrix(roomName: string): CostMatrix {
  return queryCostMatrix(
    `defense-rampartQueryCostMatrix-${roomName}`,
    () => {
      const costMatrix = new PathFinder.CostMatrix();
      // Fill with walls and ramparts
      const room = Game.rooms[roomName];
      if (!room) {
        return costMatrix;
      }
      const terrain = room.getTerrain();
      for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
          if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
            costMatrix.set(x, y, 255);
          }
        }
      }
      const ramparts = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL
      });
      for (const rampart of ramparts) {
        costMatrix.set(rampart.pos.x, rampart.pos.y, 255);
      }

      return costMatrix;
    },
    1
  );
}

export function rampartWallMatrix(roomName: string): CostMatrix {
  return queryCostMatrix(
    `defense-rampartQueryCostMatrix-${roomName}`,
    () => {
      const costMatrix = new PathFinder.CostMatrix();
      // Fill with walls and ramparts
      const room = Game.rooms[roomName];
      if (!room) {
        return costMatrix;
      }
      const terrain = room.getTerrain();
      for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
          if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
            costMatrix.set(x, y, 2);
          }
        }
      }
      const ramparts = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_RAMPART
      });
      for (const rampart of ramparts) {
        costMatrix.set(rampart.pos.x, rampart.pos.y, 1);
      }
      const walls = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_WALL
      });
      for (const wall of walls) {
        costMatrix.set(wall.pos.x, wall.pos.y, 2);
      }

      return costMatrix;
    },
    1
  );
}
