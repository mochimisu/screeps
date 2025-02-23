import { TowerDrainStrategy } from "./strats/simple-tower-drain/simple-tower-drain";

export type AttackStrategy = TowerDrainStrategy;

declare global {
  interface Memory {
    attack: {
      [roomName: string]: AttackStrategy;
    };
  }
}

export function getMemoryAttack() {
  if (Memory.attack == null) {
    Memory.attack = {};
  }
  return Memory.attack;
}
