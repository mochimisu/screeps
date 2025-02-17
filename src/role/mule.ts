import { spawnInRoom } from "manager/spawn";
import { ClockworkMultiroomFlowField } from "screeps-clockwork";
import { bodyPart } from "utils/body-part";
import { getCachedClockworkFlowMap, getSurroundingPositions, moveToWithClockwork } from "utils/clockwork";
import { creepsByRole } from "utils/query";

import { isMule, MuleCreep, MulePath } from "./mule.type";

const mulePaths: Record<string, MulePath> = {
  "second-to-main": {
    numMules: 0,
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
    numMules: 0,
    // main s4orage
    source: "679a16c3135bf04cc4b9f12e",
    // second storage
    sink: "67a143d162f5371cbb7bb49b",
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity(RESOURCE_ENERGY) > 20000 && sink.store.getUsedCapacity(RESOURCE_ENERGY) < 8000,
    idlePosition: new RoomPosition(27, 27, "W22S58"),
    resourceType: RESOURCE_ENERGY,
    parts: [...bodyPart(CARRY, 12), ...bodyPart(MOVE, 6)]
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
    numMules: 1,
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

function getSinkTransferPos(path: MulePath): RoomPosition[] {
  const sink = Game.getObjectById<StructureStorage>(path.sink);
  return path.sinkTransferPos ? [path.sinkTransferPos] : sink ? getSurroundingPositions(sink.pos) : [];
}

function getSourceTransferPos(path: MulePath): RoomPosition[] {
  const source = Game.getObjectById<StructureStorage>(path.source);
  return path.sourceTransferPos ? [path.sourceTransferPos] : source ? getSurroundingPositions(source.pos) : [];
}

function getSourceClockworkPaths(pathName: string): ClockworkMultiroomFlowField[] {
  const pathDef = mulePaths[pathName];
  const fields = [
    getCachedClockworkFlowMap(`mule-path-${pathName}-sink2source`, () => ({
      from: getSinkTransferPos(pathDef),
      to: getSourceTransferPos(pathDef)
    }))
  ];
  const idlePos = pathDef.idlePosition;
  if (idlePos) {
    fields.push(
      getCachedClockworkFlowMap(`mule-path-${pathName}-idle2source`, () => ({
        from: [idlePos],
        to: getSourceTransferPos(pathDef)
      }))
    );
  }
  return fields.filter(f => f != null);
}

function getSinkClockworkPaths(pathName: string): ClockworkMultiroomFlowField[] {
  const pathDef = mulePaths[pathName];
  const fields = [
    getCachedClockworkFlowMap(`mule-path-${pathName}-source2sink`, () => ({
      from: getSourceTransferPos(pathDef),
      to: getSinkTransferPos(pathDef)
    }))
  ];
  return fields.filter(f => f != null);
}

function getIdleClockworkPaths(pathName: string): ClockworkMultiroomFlowField[] {
  const pathDef = mulePaths[pathName];
  const idlePosition = pathDef.idlePosition;
  if (idlePosition == null) {
    return [];
  }
  return [
    getCachedClockworkFlowMap(`mule-path-${pathName}-source2idle`, () => ({
      from: getSourceTransferPos(pathDef),
      to: [idlePosition]
    })),
    getCachedClockworkFlowMap(`mule-path-${pathName}-sink2idle`, () => ({
      from: getSinkTransferPos(pathDef),
      to: [idlePosition]
    }))
  ].filter(f => f != null);
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
        moveToWithClockwork(creep, source, getSourceClockworkPaths(path), { sayDebug: true });
      }
    } else {
      if (pathDef.idlePosition && creep.pos.getRangeTo(pathDef.idlePosition) > 0) {
        moveToWithClockwork(creep, pathDef.idlePosition ?? source, getIdleClockworkPaths(path), {
          sayDebug: true,
          stuckOk: true
        });
      }
    }
  }

  // Deposit to sink
  if (creep.memory.status === "deposit") {
    for (const resourceType in creep.store) {
      const transferStatus = creep.transfer(sink, resourceType as ResourceConstant);
      if (transferStatus === ERR_NOT_IN_RANGE) {
        moveToWithClockwork(creep, sink, getSinkClockworkPaths(path), { sayDebug: true });
      }
    }
    // TODO backup sink
  }
}
