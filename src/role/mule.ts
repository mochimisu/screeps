import { moveToIdleSpot } from "manager/idle";
import { spawnInRoom } from "manager/spawn";
import { MuleCreep, MulePath, isMule } from "./mule.type";
import { getSiteResource } from "site/energy-storage-site/site";

const mulePaths: Record<string, MulePath> = {
  "second-to-main": {
    numMules: 1,
    // second storage
    source: "67a143d162f5371cbb7bb49b",
    // main south link
    sink: "6799f5bad11320315980dc99",
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity(RESOURCE_ENERGY) > 20000,
    idlePosition: new RoomPosition(17, 16, "W22S59")
  },
  "main-mineral-ess": {
    numMules: 1,
    // main mineral buffer
    source: "67a32bbb4096703d1badac79",
    // main storage
    sink: "679a16c3135bf04cc4b9f12e",
    condition: (source: StructureStorage | StructureContainer, sink: StructureStorage | StructureContainer) =>
      source.store.getUsedCapacity() > 100 &&
      sink.store.getFreeCapacity() > 10000 &&
      getSiteResource("W22S58", RESOURCE_OXYGEN) < 100000,
    idlePosition: new RoomPosition(9, 15, "W22S58")
  }
};

export function muleSpawnLoop(): boolean {
  const mules = _.filter(Game.creeps, creep => creep.memory.role === "mule");
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
  for (const path in mulePaths) {
    const needed = mulePaths[path].numMules - (muleCounts[path] || 0);
    if (needed > 0) {
      mulesNeeded[path] = needed;
    }
  }

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
        parts: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE]
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
    if (!pathDef.condition?.(source, sink)) {
      if (pathDef.idlePosition) {
        creep.moveTo(pathDef.idlePosition, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      } else if (!moveToIdleSpot(creep)) {
        creep.moveTo(source, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
      return;
    }
    for (const resourceType in source.store) {
      if (creep.withdraw(source, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
        return;
      }
    }
    return;
  }

  // Deposit to sink
  if (creep.memory.status === "deposit") {
    for (const resourceType in creep.store) {
      if (creep.transfer(sink, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sink, {
          visualizePathStyle: { stroke: "#ffffff" }
        });
        return;
      }
    }
  }
}
