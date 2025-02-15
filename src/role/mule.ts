import { moveToIdleSpot } from "manager/idle";
import { spawnInRoom } from "manager/spawn";
import { MuleCreep, MulePath, isMule } from "./mule.type";
import { getSiteResource } from "site/energy-storage-site/site";
import { bodyPart } from "utils/body-part";
import { creepsByRole } from "utils/query";

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
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity() > 100 && sink.store.getFreeCapacity() > 10000,
    idlePosition: new RoomPosition(9, 15, "W22S58")
  },
  "second-mineral-ess": {
    numMules: 1,
    // second mineral buffer
    source: "67afea384096702585b11eb7",
    // second storage
    sink: "67a143d162f5371cbb7bb49b",
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity() > 100 && sink.store.getFreeCapacity() > 10000,
    idlePosition: new RoomPosition(31, 14, "W22S59")
  },
  "third-energy-ess": {
    numMules: 2,
    source: "67a936f6d2beb34270391d74",
    sink: "67ab4af7918897273c038658",
    // fix
    condition: (source: StructureStorage | StructureContainer) => source.store.getUsedCapacity(RESOURCE_ENERGY) > 0,
    idlePosition: new RoomPosition(20, 40, "W21S58"),
    parts: [...bodyPart(CARRY, 10), ...bodyPart(MOVE, 5)]
  },
  "third-energy-main": {
    numMules: 4,
    source: "67ab4af7918897273c038658",
    sink: "679a16c3135bf04cc4b9f12e",
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity(RESOURCE_ENERGY) > 100000 && sink.store.getFreeCapacity(RESOURCE_ENERGY) > 100000,
    idlePosition: new RoomPosition(30, 22, "W21S58"),
    parts: [...bodyPart(CARRY, 10), ...bodyPart(MOVE, 5)]
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
  if (creep.memory.status === "withdraw") {
    const source = Game.getObjectById<StructureStorage>(pathDef.source);
    if (source == null) {
      console.log(`Unknown source ${pathDef.source}`);
      return;
    }
    if (pathDef.condition != null && !pathDef.condition?.(source, sink)) {
      if (pathDef.idlePosition) {
        creep.moveTo(pathDef.idlePosition, {
          visualizePathStyle: { stroke: "#ffaa00" },
          reusePath: 10
        });
      } else if (!moveToIdleSpot(creep)) {
        creep.moveTo(source, {
          visualizePathStyle: { stroke: "#ffaa00" },
          reusePath: 10
        });
      }
      return;
    }
    if (pathDef.resourceType) {
      if (creep.withdraw(source, pathDef.resourceType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, {
          visualizePathStyle: { stroke: "#ffaa00" },
          reusePath: 10
        });
        return;
      }
    } else {
      for (const resourceType in source.store) {
        if (creep.withdraw(source, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, {
            visualizePathStyle: { stroke: "#ffaa00" },
            reusePath: 10
          });
          return;
        }
      }
    }
    return;
  }

  // Deposit to sink
  if (creep.memory.status === "deposit") {
    for (const resourceType in creep.store) {
      const transferStatus = creep.transfer(sink, resourceType as ResourceConstant);
      if (transferStatus === ERR_NOT_IN_RANGE) {
        creep.moveTo(sink, {
          visualizePathStyle: { stroke: "#ffffff" },
          reusePath: 10
        });
        return;
      }
    }
    // If sink failed, go to backup sink
    if (pathDef.backupSink != null) {
      for (const resourceType in creep.store) {
        const backupSink = Game.getObjectById<StructureStorage>(pathDef.backupSink);
        if (backupSink == null) {
          console.log(`Unknown backup sink ${pathDef.backupSink}`);
          return;
        }
        const transferStatus = creep.transfer(backupSink, resourceType as ResourceConstant);
        if (transferStatus === ERR_NOT_IN_RANGE) {
          creep.moveTo(backupSink, {
            visualizePathStyle: { stroke: "#ffffff" },
            reusePath: 10
          });
          return;
        }
      }
    }
  }
}
