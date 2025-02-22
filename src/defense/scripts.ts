import { compact } from "lodash";
import {
  bfsUntilRampart,
  DefenseStrategy,
  getMemoryDefense,
  rampartCostMatrix,
  RampartDefenseArea,
  rampartWallMatrix
} from "./defense";
import { findUniqueUnfriendlyExitPositions } from "utils/room";
import { Grid4Bit, Grid8Bit } from "utils/compact-grid";
import { queryCostMatrix } from "utils/query";

function setStrat(roomName: string, strat: DefenseStrategy): void {
  const memory = getMemoryDefense();
  memory.strategy[roomName] = strat;
}

export function calcRampartDefense(roomName: string): void {
  // From the exits, find all connected points that cannot pass a rampart. this defines a danger area.
  // The touching ramparts are the rampartMelee.
  // The ramparts that are connected to rampartMelee are rampartRanged.
  const exits = findUniqueUnfriendlyExitPositions(roomName);
  // 1 pad this so we can use matrix values as indices
  const dangerAreas: RampartDefenseArea[] = [];
  let dangerAreaIndex = 1;
  console.log("Exits: " + exits.length);
  const defenseMatrix = new Grid4Bit();
  for (const exit of exits) {
    if (defenseMatrix.get(exit.x, exit.y) !== 0) {
      continue;
    }

    const bfsResult = bfsUntilRampart(roomName, exit);
    const dangerArea = bfsResult.result;
    const ramparts = bfsResult.ramparts;
    for (const pos of dangerArea) {
      defenseMatrix.set(pos.x, pos.y, dangerAreaIndex);
    }
    const rangedRamparts = findRangedRamparts(roomName, ramparts);
    // console.log("Danger area for exit " + exit + ": " + dangerArea.length);
    // console.log("  Melee Ramparts: " + ramparts);
    // console.log("  Ranged Ramparts: " + rangedRamparts);
    // console.log("defenseMatrix:");
    // defenseMatrix.print();
    dangerAreas.push({
      rampartMelee: ramparts,
      rampartRanged: rangedRamparts
    });
    dangerAreaIndex++;
  }

  setStrat(roomName, {
    type: "base-rampart",
    roomName,
    defenseAreas: dangerAreas,
    defenseAreaMatrix: defenseMatrix.serialize()
  });
  console.log("Defense strategy for " + roomName + " is base-rampart");
  defenseMatrix.print();
}

function findRangedRamparts(roomName: string, meleeRamparts: RoomPosition[]): RoomPosition[] {
  const rwMtx = rampartWallMatrix(roomName);
  const visited = new Set<string>();
  const queue = Array.from(meleeRamparts);
  const meleeRampartsSet = new Set(meleeRamparts.map(p => p.toString()));
  const result = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const curStr = current.toString();
    if (visited.has(curStr)) {
      continue;
    }
    visited.add(curStr);
    if (rwMtx.get(current.x, current.y) === 1) {
      if (!meleeRampartsSet.has(curStr)) {
        result.push(current);
      }
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
  }
  return result;
}

export function calcStrat(roomName: string): void {
  // Determine if roaming or base.
  // Look at every exit, and if there's no path to the spawn or controller, then it's a base.
  const room = Game.rooms[roomName];
  if (!room) {
    console.log("Unknown room: " + roomName);
    return setStrat(roomName, { type: "roaming-remote-simple" });
  }

  const controller = room.controller;
  const spawns = room.find(FIND_MY_SPAWNS);
  const protectedStructures = compact([controller, ...spawns]) as Structure[];

  let hasPath = false;
  for (const exitPosition of findUniqueUnfriendlyExitPositions(room.name)) {
    console.log("Checking exit position: " + exitPosition);
    for (const struct of protectedStructures) {
      const path = room.findPath(exitPosition, struct.pos, {
        costCallback: rampartCostMatrix
      });
      if (path.length > 0 && path[path.length - 1].x === struct.pos.x && path[path.length - 1].y === struct.pos.y) {
        console.log("Found path to " + struct.structureType);
        console.log(JSON.stringify(path));
        hasPath = true;
        break;
      }
    }
    if (hasPath) {
      break;
    }
  }

  if (hasPath) {
    console.log("Strat for " + roomName + " is roaming-remote-simple");
    return setStrat(roomName, { type: "roaming-remote-simple" });
  } else {
    console.log("Strat for " + roomName + " is base");
    return calcRampartDefense(roomName);
  }
}

export function setIdleSpot(roomName: string, posXY: [number, number]): void {
  const memory = getMemoryDefense();
  if (memory.strategy[roomName].type !== "roaming-remote-simple") {
    return;
  }
  memory.strategy[roomName].idleSpot = new RoomPosition(posXY[0], posXY[1], roomName);
}

const defScripts = {
  calcStrat,
  setIdleSpot
};

declare global {
  export namespace NodeJS {
    export interface Global {
      def: typeof defScripts;
    }
  }
}

global.def = defScripts;
