import { moveToIdleSpot } from "manager/idle";
import { spawnInRoom } from "manager/spawn";
import { MuleCreep, MulePath, isMule } from "./mule.type";
import { getSiteResource } from "site/energy-storage-site/site";
import { bodyPart } from "utils/body-part";
import { creepsByRole } from "utils/query";
import {
  ClockworkFlowField,
  ClockworkMultiroomFlowField,
  FlowField,
  astarMultiroomDistanceMap,
  dijkstraMultiroomDistanceMap,
  ephemeral,
  getTerrainCostMatrix
} from "screeps-clockwork";
import { ClockworkMultiroomDistanceMap } from "screeps-clockwork/dist/src/wrappers/multiroomDistanceMap";
import { compact } from "lodash";
import { getAdjustedTerrainCostMatrix, moveToWithClockwork } from "utils/clockwork";

const mulePaths: Record<string, MulePath> = {
  "second-to-main": {
    numMules: 1,
    // second storage
    source: "67a143d162f5371cbb7bb49b",
    // main south link
    sink: "6799f5bad11320315980dc99",
    backupSink: "67a143d162f5371cbb7bb49b",
    condition: (source: StructureStorage | StructureContainer) => source.store.getUsedCapacity(RESOURCE_ENERGY) > 20000,
    idlePosition: new RoomPosition(17, 16, "W22S59"),
    resourceType: RESOURCE_ENERGY
  },
  "main-to-second": {
    numMules: 4,
    // main s4orage
    source: "679a16c3135bf04cc4b9f12e",
    // second storage
    sink: "67a143d162f5371cbb7bb49b",
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity(RESOURCE_ENERGY) > 20000 && sink.store.getUsedCapacity(RESOURCE_ENERGY) < 8000,
    idlePosition: new RoomPosition(27, 27, "W22S58"),
    resourceType: RESOURCE_ENERGY,
    parts: [...bodyPart(CARRY, 6), ...bodyPart(MOVE, 3)]
  },
  "main-mineral-ess": {
    numMules: 1,
    // main mineral buffer
    source: "67a32bbb4096703d1badac79",
    // main storage
    sink: "679a16c3135bf04cc4b9f12e",
    sinkTransferPos: new RoomPosition(30, 15, "W22S58"),
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity() > 200 && sink.store.getFreeCapacity() > 10000,
    idlePosition: new RoomPosition(9, 15, "W22S58")
  },
  "second-mineral-ess": {
    numMules: 1,
    // second mineral buffer
    source: "67afea384096702585b11eb7",
    // second storage
    sink: "67a143d162f5371cbb7bb49b",
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity() > 200 && sink.store.getFreeCapacity() > 10000,
    idlePosition: new RoomPosition(31, 14, "W22S59")
  },
  "third-energy-ess": {
    numMules: 2,
    source: "67a936f6d2beb34270391d74",
    sourceTransferPos: new RoomPosition(22, 41, "W21S58"),
    sink: "67ab4af7918897273c038658",
    sinkTransferPos: new RoomPosition(29, 20, "W21S58"),
    // fix
    condition: (source: StructureStorage | StructureContainer) => source.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
    idlePosition: new RoomPosition(20, 40, "W21S58"),
    parts: [...bodyPart(CARRY, 8), ...bodyPart(MOVE, 4)]
  },
  "third-energy-main": {
    numMules: 2,
    source: "67ab4af7918897273c038658",
    sourceTransferPos: new RoomPosition(28, 20, "W21S58"),
    sink: "67ac472186eef035eca87012",
    sinkTransferPos: new RoomPosition(48, 18, "W22S58"),
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity(RESOURCE_ENERGY) > 50000 && sink.store.getFreeCapacity(RESOURCE_ENERGY) > 200,
    idlePosition: new RoomPosition(30, 22, "W21S58"),
    parts: [...bodyPart(CARRY, 14), ...bodyPart(MOVE, 7)]
  }
};

interface MuleClockworkPath {
  toSink: ClockworkMultiroomFlowField[];
  toSource: ClockworkMultiroomFlowField[];
  toIdle: ClockworkMultiroomFlowField[];
  validUntil: number;
}
const muleClockworkPaths: Record<string, MuleClockworkPath> = {};
console.log("muleClockworkPaths", Object.keys(muleClockworkPaths).length);

export function muleSpawnLoop(): boolean {
  const mules = creepsByRole("mule") as MuleCreep[];
  const muleCounts: Record<string, number> = {};
  for (const mule of mules) {
    if (!isMule(mule)) {
      continue;
    }
    const path = mule.memory.path;
    if (path == null) {
      console.log(`Mule ${mule.name} has no path`);
      continue;
    }
    if (muleCounts[path] == null) {
      muleCounts[path] = 0;
    }
    muleCounts[path]++;
  }

  const mulesNeeded: Record<string, number> = {};
  for (const pathName in mulePaths) {
    // Check if predicate passes
    const mulePath = mulePaths[pathName];
    const source = Game.getObjectById<StructureStorage>(mulePath.source);
    const sink = Game.getObjectById<StructureStorage>(mulePath.sink);
    if (source == null || sink == null) {
      console.log(`Unknown source or sink for path ${pathName}`);
      continue;
    }
    if (mulePath.condition != null && !mulePath.condition?.(source, sink)) {
      continue;
    }
    const needed = mulePath.numMules - (muleCounts[pathName] || 0);
    if (needed > 0) {
      mulesNeeded[pathName] = needed;
    }
  }
  // for (const path in mulesNeeded) {
  //   console.log(`Need ${mulesNeeded[path]} mules for path ${path}`);
  // }

  for (const path in mulesNeeded) {
    const pathDef = mulePaths[path];
    const source = Game.getObjectById<Source>(pathDef.source);
    if (source == null) {
      console.log(`Unknown source ${pathDef.source}`);
      continue;
    }
    const room = source.room;
    if (
      spawnInRoom("mule", {
        roomName: room.name,
        additionalMemory: { path },
        parts: pathDef.parts ?? [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
        spawnElsewhereIfNeeded: true
      })
    ) {
      return true;
    }
  }
  return false;
}

function getClockworkPath(pathName: string): MuleClockworkPath | null {
  if (muleClockworkPaths[pathName] != null) {
    if (muleClockworkPaths[pathName].validUntil < Game.time) {
      muleClockworkPaths[pathName].toSink.map(ff => ff.free());
      muleClockworkPaths[pathName].toSource.map(ff => ff.free());
      muleClockworkPaths[pathName].toIdle.map(ff => ff.free());
      delete muleClockworkPaths[pathName];
    } else {
      return muleClockworkPaths[pathName];
    }
  }
  const path = mulePaths[pathName];
  if (path == null) {
    console.log(`Unknown path ${pathName}`);
    return null;
  }
  const source = Game.getObjectById<StructureStorage>(path.source);
  const sink = Game.getObjectById<StructureStorage>(path.sink);
  if (source == null || sink == null) {
    console.log(`Unknown source or sink for path`);
    return null;
  }

  // For some reason these are all freaking backwards
  const sinkTransferPos = path.sinkTransferPos
    ? [path.sinkTransferPos]
    : [
        new RoomPosition(sink.pos.x, sink.pos.y, sink.pos.roomName),
        new RoomPosition(sink.pos.x + 1, sink.pos.y, sink.pos.roomName),
        new RoomPosition(sink.pos.x, sink.pos.y + 1, sink.pos.roomName),
        new RoomPosition(sink.pos.x + 1, sink.pos.y + 1, sink.pos.roomName),
        new RoomPosition(sink.pos.x - 1, sink.pos.y, sink.pos.roomName),
        new RoomPosition(sink.pos.x, sink.pos.y - 1, sink.pos.roomName),
        new RoomPosition(sink.pos.x - 1, sink.pos.y - 1, sink.pos.roomName),
        new RoomPosition(sink.pos.x - 1, sink.pos.y + 1, sink.pos.roomName),
        new RoomPosition(sink.pos.x + 1, sink.pos.y - 1, sink.pos.roomName)
      ];
  const sourceTransferPos = path.sourceTransferPos
    ? [path.sourceTransferPos]
    : [
        new RoomPosition(source.pos.x, source.pos.y, source.pos.roomName),
        new RoomPosition(source.pos.x + 1, source.pos.y, source.pos.roomName),
        new RoomPosition(source.pos.x, source.pos.y + 1, source.pos.roomName),
        new RoomPosition(source.pos.x + 1, source.pos.y + 1, source.pos.roomName),
        new RoomPosition(source.pos.x - 1, source.pos.y, source.pos.roomName),
        new RoomPosition(source.pos.x, source.pos.y - 1, source.pos.roomName),
        new RoomPosition(source.pos.x - 1, source.pos.y - 1, source.pos.roomName),
        new RoomPosition(source.pos.x - 1, source.pos.y + 1, source.pos.roomName)
      ];
  const idlePosition = path.idlePosition ? [path.idlePosition] : sourceTransferPos;
  const sourceToSink = dijkstraMultiroomDistanceMap(sinkTransferPos, {
    allOfDestinations: sourceTransferPos.map(pos => ({ pos, range: 1 })),
    costMatrixCallback: getAdjustedTerrainCostMatrix,
    maxRooms: 3
  });
  const sinkToSource = dijkstraMultiroomDistanceMap(sourceTransferPos, {
    allOfDestinations: sinkTransferPos.map(pos => ({ pos, range: 1 })),
    costMatrixCallback: getAdjustedTerrainCostMatrix,
    maxRooms: 3
  });
  const idleToSource = dijkstraMultiroomDistanceMap(sourceTransferPos, {
    allOfDestinations: idlePosition.map(pos => ({ pos, range: 1 })),
    costMatrixCallback: getAdjustedTerrainCostMatrix,
    maxRooms: 3
  });
  const sourceToIdle = dijkstraMultiroomDistanceMap(idlePosition, {
    allOfDestinations: sourceTransferPos.map(pos => ({ pos, range: 1 })),
    costMatrixCallback: getAdjustedTerrainCostMatrix,
    maxRooms: 3
  });
  const sinkToIdle = dijkstraMultiroomDistanceMap(idlePosition, {
    allOfDestinations: sinkTransferPos.map(pos => ({ pos, range: 1 })),
    costMatrixCallback: getAdjustedTerrainCostMatrix,
    maxRooms: 3
  });

  console.log("Created clockwork path for", pathName);
  console.log("    sourceToSink", sourceToSink.foundTargets.length, sourceToSink.ops);
  console.log("    sinkToSource", sinkToSource.foundTargets.length, sinkToSource.ops);
  console.log("    idleToSource", idleToSource.foundTargets.length, idleToSource.ops);
  console.log("    sourceToIdle", sourceToIdle.foundTargets.length, sourceToIdle.ops);
  console.log("    sinkToIdle", sinkToIdle.foundTargets.length, sinkToIdle.ops);

  muleClockworkPaths[pathName] = {
    toSink: [ephemeral(sourceToSink.distanceMap).toFlowField()],
    toSource: [ephemeral(sinkToSource.distanceMap).toFlowField(), ephemeral(idleToSource.distanceMap).toFlowField()],
    toIdle: [ephemeral(sourceToIdle.distanceMap).toFlowField(), ephemeral(sinkToIdle.distanceMap).toFlowField()],
    validUntil: Game.time + 100
  };
  return muleClockworkPaths[pathName];
}

export function muleLoop(creep: MuleCreep): void {
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "withdraw";
  }
  if (creep.store.getFreeCapacity() === 0) {
    creep.memory.status = "deposit";
  }
  if (creep.memory.status == null) {
    creep.memory.status = "withdraw";
  }

  const path = creep.memory.path;
  if (path == null) {
    console.log(`Mule ${creep.name} has no path`);
    return;
  }
  const pathDef = mulePaths[path];
  if (pathDef == null) {
    console.log(`Unknown path ${path}`);
    return;
  }

  // Withdraw from source
  const sink = Game.getObjectById<StructureStorage>(pathDef.sink);
  if (sink == null) {
    console.log(`Unknown sink ${pathDef.sink}`);
    return;
  }
  const source = Game.getObjectById<StructureStorage>(pathDef.source);
  if (source == null) {
    console.log(`Unknown source ${pathDef.source}`);
    return;
  }
  let targetType: "idle" | "source" | "sink" | null = null;
  if (creep.memory.status === "withdraw") {
    if (pathDef.condition == null || pathDef.condition?.(source, sink)) {
      let withdrawStatus;
      if (pathDef.resourceType) {
        withdrawStatus = creep.withdraw(source, pathDef.resourceType);
      } else {
        for (const resourceType in source.store) {
          withdrawStatus = creep.withdraw(source, resourceType as ResourceConstant);
          if (withdrawStatus === OK) {
            break;
          }
        }
      }
      if (withdrawStatus === ERR_NOT_IN_RANGE) {
        targetType = "source";
      }
    } else {
      targetType = "idle";
    }
  }

  // Deposit to sink
  if (creep.memory.status === "deposit") {
    for (const resourceType in creep.store) {
      const transferStatus = creep.transfer(sink, resourceType as ResourceConstant);
      if (transferStatus === ERR_NOT_IN_RANGE) {
        targetType = "sink";
      }
    }
    // TODO backup sink
  }

  if (targetType === "idle" && pathDef.idlePosition != null) {
    if (creep.pos.getRangeTo(pathDef.idlePosition) > 0) {
      moveToWithClockwork(creep, pathDef.idlePosition ?? source, getClockworkPath(path)?.toIdle, { sayDebug: true });
    }
  } else if (targetType === "source") {
    moveToWithClockwork(creep, source, getClockworkPath(path)?.toSource, { sayDebug: true });
  } else if (targetType === "sink") {
    moveToWithClockwork(creep, sink, getClockworkPath(path)?.toSink, { sayDebug: true });
  }
}
