export type RampartDefenseArea = {
  dangerArea: RoomPosition[];
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
    };

export type DefenseQuadrantStatus = {
  numEnemies: number;
  enemyDPSTotal: number;
  enemyHPSTotal: number;
};

declare global {
  interface Memory {
    defense: {
      [roomName: string]: DefenseStrategy;
    };
  }
}

export function getMemoryDefense() {
  if (Memory.defense == null) {
    Memory.defense = {};
  }
  return Memory.defense;
}
