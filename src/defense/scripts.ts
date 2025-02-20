import { compact } from "lodash";
import { DefenseStrategy, getMemoryDefense } from "./defense";
import { findUniqueUnfriendlyExitPositions } from "utils/room";

function setStrat(roomName: string, strat: DefenseStrategy): void {
  const memory = getMemoryDefense();
  memory[roomName] = strat;
}

export function calcRampartDefense(roomName: string): void {
  // From the exits, find all connected points that cannot pass a rampart. this defines a danger area.
  // The touching ramparts are the rampartMelee.
  // The ramparts that are connected to rampartMelee are rampartRanged.
  const exits = findUniqueUnfriendlyExitPositions(roomName);
  const seenDangerAreas = new Set<RoomPosition>();
  const dangerAreas = [];
  console.log("Exits: " + exits.length);
  for (const exit of exits) {
    if (seenDangerAreas.has(exit)) {
      continue;
    }
    const bfsResult = bfsUntilRampart(roomName, exit);
    const dangerArea = bfsResult.result;
    const ramparts = bfsResult.ramparts;
    for (const pos of dangerArea) {
      seenDangerAreas.add(pos);
    }
    dangerAreas.push({
      dangerArea: Array.from(dangerArea),
      rampartMelee: Array.from(ramparts),
      rampartRanged: Array.from(findRangedRamparts(roomName, ramparts))
    });
  }
  setStrat(roomName, {
    type: "base-rampart",
    roomName,
    defenseAreas: dangerAreas
  });
}

function bfsUntilRampart(
  roomName: string,
  start: RoomPosition
): {
  result: RoomPosition[];
  ramparts: RoomPosition[];
} {
  const visited = new Set<string>();
  const queue = [start];
  const result = [];
  const ramparts = [];
  const seenRamparts = new Set<string>();
  const room = Game.rooms[roomName];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (visited.has(current.toString())) {
      continue;
    }
    visited.add(current.toString());
    if (room.lookForAt(LOOK_STRUCTURES, current).some(s => s.structureType === STRUCTURE_RAMPART)) {
      if (seenRamparts.has(current.toString())) {
        continue;
      }
      ramparts.push(current);
      seenRamparts.add(current.toString());
      continue;
    }
    result.push(current);
    if (current.x > 0) {
      queue.push(new RoomPosition(current.x - 1, current.y, roomName));
    }
    if (current.x < 49) {
      queue.push(new RoomPosition(current.x + 1, current.y, roomName));
    }
    if (current.y > 0) {
      queue.push(new RoomPosition(current.x, current.y - 1, roomName));
    }
    if (current.y < 49) {
      queue.push(new RoomPosition(current.x, current.y + 1, roomName));
    }
  }

  return {
    result,
    ramparts
  };
}

function findRangedRamparts(roomName: string, meleeRamparts: RoomPosition[]): RoomPosition[] {
  const visited = new Set<string>();
  const queue = Array.from(meleeRamparts);
  const meleeRampartsSet = new Set(meleeRamparts.map(p => p.toString()));
  const room = Game.rooms[roomName];
  const result = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (visited.has(current.toString())) {
      continue;
    }
    visited.add(current.toString());
    if (
      room.lookForAt(LOOK_STRUCTURES, current).some(s => s.structureType === STRUCTURE_RAMPART) &&
      !meleeRampartsSet.has(current.toString())
    ) {
      result.push(current);
    }
    if (current.x > 0) {
      queue.push(new RoomPosition(current.x - 1, current.y, roomName));
    }
    if (current.x < 49) {
      queue.push(new RoomPosition(current.x + 1, current.y, roomName));
    }
    if (current.y > 0) {
      queue.push(new RoomPosition(current.x, current.y - 1, roomName));
    }
    if (current.y < 49) {
      queue.push(new RoomPosition(current.x, current.y + 1, roomName));
    }
  }
  return result;
}

function rampartCostCallback(roomName: string): CostMatrix {
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
}

export function calcStrat(roomName: string): void {
  // Determine if roaming or base.
  // Look at every exit, and if there's no path to the spawn or controller, then it's a base.
  const room = Game.rooms[roomName];
  if (!room) {
    console.log("Unknown room: " + roomName);
    return setStrat(roomName, { type: "roaming-remote" });
  }

  const controller = room.controller;
  const spawns = room.find(FIND_MY_SPAWNS);
  const protectedStructures = compact([controller, ...spawns]) as Structure[];

  let hasPath = false;
  for (const exitPosition of findUniqueUnfriendlyExitPositions(room.name)) {
    console.log("Checking exit position: " + exitPosition);
    for (const struct of protectedStructures) {
      const path = room.findPath(exitPosition, struct.pos, {
        costCallback: rampartCostCallback
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
    console.log("Strat for " + roomName + " is roaming-remote");
    return setStrat(roomName, { type: "roaming-remote" });
  } else {
    console.log("Strat for " + roomName + " is base");
    return calcRampartDefense(roomName);
  }
}

const defScripts = {
  calcStrat
};

declare global {
  export namespace NodeJS {
    export interface Global {
      def: typeof defScripts;
    }
  }
}

global.def = defScripts;
