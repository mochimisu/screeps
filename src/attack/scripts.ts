import { AttackStrategy, getMemoryAttack } from "./attack";
import * as towerDrainScripts from "./strats/simple-tower-drain/scripts";

export function towerDrain(roomName: string, fromRoom: string, rallyId?: string): void {
  const mem = getMemoryAttack();
  if (mem[roomName] == null) {
    mem[roomName] = {
      type: "simple-tower-drain",
      fromRoom,
      rallyId
    };
  }
}

const atkScripts = {
  towerDrain,
  td: towerDrainScripts
};

declare global {
  export namespace NodeJS {
    export interface Global {
      atk: typeof atkScripts;
    }
  }
}

global.atk = atkScripts;
