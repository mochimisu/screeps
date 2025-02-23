import { getMemoryAttack } from "attack/attack";
import { Grid8Bit } from "utils/compact-grid";

export function printDpsMap(roomName: string): void {
  const mem = getMemoryAttack();
  const strategy = mem[roomName];
  if (strategy?.type !== "simple-tower-drain") {
    console.log("ERROR: Not a simple-tower-drain strategy for " + roomName);
    return;
  }
  if (strategy.towerDpsMap == null) {
    console.log("ERROR: No DPS map for " + roomName);
    return;
  }
  console.log("DPS map for " + roomName + ":");
  const grid = Grid8Bit.fromSerialized(strategy.towerDpsMap);
  let minDps = Infinity;
  for (let y = 0; y < 50; y++) {
    let row = "";
    for (let x = 0; x < 50; x++) {
      const val = grid.get(x, y);
      if (val === 255) {
        row += "-----";
      } else {
        row += (grid.get(x, y) * 50).toString().padStart(5, " ");
        minDps = Math.min(minDps, val);
      }
    }
    console.log(row);
  }

  // Find number of cells @ minimum DPS
  let minCount = 0;
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      if (grid.get(x, y) === minDps) {
        minCount++;
      }
    }
  }
  console.log("Min DPS: " + minDps * 50 + " (" + minCount + ")");
}

export function printTankMoveMap(roomName: string): void {
  const mem = getMemoryAttack();
  const strategy = mem[roomName];
  if (strategy?.type !== "simple-tower-drain") {
    console.log("ERROR: Not a simple-tower-drain strategy for " + roomName);
    return;
  }
  if (strategy.tankMoveMap == null) {
    console.log("ERROR: No tank move map for " + roomName);
    return;
  }
  console.log("Tank move map for " + roomName + ":");
  const grid = Grid8Bit.fromSerialized(strategy.tankMoveMap);
  for (let y = 0; y < 50; y++) {
    let row = "";
    for (let x = 0; x < 50; x++) {
      const val = grid.get(x, y);
      row += val === 255 ? "xXx" : "   ";
    }
    console.log(row);
  }
}
