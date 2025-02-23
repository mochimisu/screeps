import {
  ClockworkCostMatrix,
  ClockworkMultiroomFlowField,
  dijkstraMultiroomDistanceMap,
  ephemeral,
  getTerrainCostMatrix
} from "screeps-clockwork";

import { query } from "./query";

declare global {
  interface CreepMemory {
    lastPos?: { x: number; y: number };
    ticksStuck?: number;
    stuckGrace?: number;
  }
}

export function moveToWithClockwork(
  creep: Creep,
  target: RoomPosition | { pos: RoomPosition },
  flowFields?: ClockworkMultiroomFlowField[],
  options?: {
    sayDebug: boolean;
    stuckOk?: boolean;
  }
): void {
  let isStuck = false;
  if (creep.memory.stuckGrace != null && creep.memory.stuckGrace > 0) {
    creep.memory.stuckGrace -= 1;
    if (creep.memory.stuckGrace == 0) {
      delete creep.memory.stuckGrace;
    }
    isStuck = true;
  } else if (creep.memory.lastPos && creep.memory.lastPos.x === creep.pos.x && creep.memory.lastPos.y === creep.pos.y) {
    creep.memory.ticksStuck = (creep.memory.ticksStuck ?? 0) + 1;
    isStuck = creep.memory.ticksStuck >= 10;
    if (isStuck) {
      console.log(`Creep ${creep.name} is stuck for ${creep.memory.ticksStuck} ticks`);
      // 15 ticks of moveTo movement grace if stuck
      creep.memory.stuckGrace = (creep.memory.stuckGrace ?? 0) + 15;
    }
  } else {
    creep.memory.lastPos = { x: creep.pos.x, y: creep.pos.y };
    creep.memory.ticksStuck = 0;
    isStuck = false;
  }
  if (!isStuck) {
    for (const flowField of flowFields ?? []) {
      // If creep is on flowfield, use it
      const directions = flowField.getDirections(creep.pos);
      if (directions && directions.length > 0) {
        const dirIdx = Math.floor(Math.random() * directions.length);
        const direction = directions[dirIdx];
        creep.move(direction);
        if (options?.sayDebug) {
          creep.say(`cw ${direction} (${directions.length})`);
        }
        return;
      }
    }
    if (flowFields && flowFields.length > 0) {
      // try to move to origin
      const flowField = flowFields[0];
      const path = ephemeral(flowField.pathToOrigin(creep.pos));
      const nextIndex = path.findNextIndex(creep.pos);
      const numPathItems = path.length;
      if (nextIndex != null && nextIndex < numPathItems) {
        const nextPos = path.get(nextIndex);
        creep.moveTo(nextPos);
        if (options?.sayDebug) {
          creep.say(`cw origin ${nextIndex}/${numPathItems}`);
        }
        return;
      } else {
        if (options?.sayDebug) {
          creep.say(`cw no path to origin`);
        }
      }
    } else {
      if (options?.sayDebug) {
        // Pathfinding fallback
        creep.say("no flowfield");
      }
    }
  } else if (!options?.stuckOk) {
    creep.say("stuck");
  }
  creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" }, reusePath: 20 });
}

function roadQuery(roomName: string): [number, number][] {
  return query(
    `clockwork-road-${roomName}`,
    () => {
      const roads =
        Game.rooms[roomName]?.find(FIND_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_ROAD
        }) ?? [];
      return roads.map(r => [r.pos.x, r.pos.y]);
    },
    1000
  );
}

const passableStructures: Set<StructureConstant> = new Set([STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_RAMPART]);
function wallQuery(roomName: string): [number, number][] {
  return query(
    `clockwork-wall-${roomName}`,
    () => {
      // include any non passable structures
      const walls =
        Game.rooms[roomName]?.find(FIND_STRUCTURES, {
          filter: s => !passableStructures.has(s.structureType)
        }) ?? [];
      return walls.map(r => [r.pos.x, r.pos.y]);
    },
    1000
  );
}

export function getSurroundingPositions(pos: RoomPosition, radius = 1): RoomPosition[] {
  const positions = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      positions.push(new RoomPosition(pos.x + dx, pos.y + dy, pos.roomName));
    }
  }
  return positions;
}

export function getAdjustedTerrainCostMatrix(roomName: string): ClockworkCostMatrix {
  const mtx = getTerrainCostMatrix(roomName, { plainCost: 2, swampCost: 10 });
  // Adjust for stationary creep spots
  if (roomName === "W21S58") {
    mtx.set(27, 19, 255);
  } else if (roomName === "W22S58") {
    mtx.set(30, 13, 255);
    mtx.set(30, 14, 255);
  }
  // Adjust for walls
  const wallsXY = wallQuery(roomName);
  for (const [x, y] of wallsXY) {
    mtx.set(x, y, 255);
  }

  // Make roads 1 cost
  const roadsXY = roadQuery(roomName);
  for (const [x, y] of roadsXY) {
    mtx.set(x, y, 1);
  }
  return mtx;
}

const verbose = false;

const cachedClockworkPaths: Record<
  string,
  {
    flowField: ClockworkMultiroomFlowField | null;
    validUntil: number;
  }
> = {};
export function getCachedClockworkFlowMap(
  keyName: string,
  targetPosFn: () => {
    from: RoomPosition[];
    to: RoomPosition[];
    costMatrixCallback?: (roomName: string) => ClockworkCostMatrix;
  },
  ttl = 500
): ClockworkMultiroomFlowField | null {
  if (cachedClockworkPaths[keyName]) {
    if (Game.time > cachedClockworkPaths[keyName].validUntil) {
      cachedClockworkPaths[keyName].flowField?.free();
      delete cachedClockworkPaths[keyName];
    } else {
      return cachedClockworkPaths[keyName].flowField;
    }
  }
  const flowMap = getClockworkFlowMap(targetPosFn);

  if (flowMap == null) {
    console.log(`cachedClockworkFlowMap: no path found for ${keyName}`);
    cachedClockworkPaths[keyName] = {
      flowField: null,
      validUntil: Game.time + ttl
    };
  } else {
    if (verbose) {
      console.log(`cachedClockworkFlowMap: path found for ${keyName} @ ${Game.time}`);
    }
    cachedClockworkPaths[keyName] = {
      flowField: flowMap,
      validUntil: Game.time + ttl
    };
  }
  return cachedClockworkPaths[keyName].flowField;
}

export function getClockworkFlowMap(
  targetPosFn: () => {
    from: RoomPosition[];
    to: RoomPosition[];
    costMatrixCallback?: (roomName: string) => ClockworkCostMatrix;
  }
) {
  let { from, to, costMatrixCallback } = targetPosFn();
  costMatrixCallback = costMatrixCallback ?? getAdjustedTerrainCostMatrix;
  // NOTE: for whatever reason this is backwards in clockwork 0.7.1
  const distanceMapRes = dijkstraMultiroomDistanceMap(to, {
    allOfDestinations: from.map(pos => ({ pos, range: 1 })),
    costMatrixCallback: getAdjustedTerrainCostMatrix,
    maxRooms: 5
  });
  if (distanceMapRes == null || distanceMapRes.foundTargets.length === 0) {
    console.log(`cachedClockworkFlowMap: no path found`);
    ephemeral(distanceMapRes?.distanceMap);
    return null;
  }
  return ephemeral(distanceMapRes?.distanceMap).toFlowField();
}
