export type RampartDefenseArea = {
  rampartMelee: RoomPosition[];
  rampartRanged: RoomPosition[];
};

export type DefenseStrategy =
  | {
      type: "roaming-remote";
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
      [roomName: string]: DefenseStrategy;
    };
    baseDefenseStatus: {
      [roomName: string]: {
        [defenseAreaIndex: number]: DefenseQuadrantStatus;
      };
    };
  }
}

export function getMemoryDefense() {
  if (Memory.defense == null) {
    Memory.defense = {};
  }
  return Memory.defense;
}
