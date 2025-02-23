import { getMemoryAttack } from "./attack";
import { towerDrainCreepLoop, towerDrainLoop } from "./strats/simple-tower-drain/loop";

export function attackLoop() {
  const mem = getMemoryAttack();
  for (const roomName in mem) {
    const strategy = mem[roomName];
    if (strategy.type === "simple-tower-drain") {
      towerDrainLoop(roomName);
    }
  }
  // creep loops
  towerDrainCreepLoop();
}
