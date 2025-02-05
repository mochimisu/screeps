import { moveToIdleSpot } from "manager/idle";
import { spawnInRoom } from "manager/spawn";

interface MulePath {
  numMules: number;
  source: string;
  sink: string;
  sourceCondition?: (storage: StructureStorage) => boolean;
}

const mulePaths: Record<string, MulePath> = {
  "second-to-main": {
    numMules: 1,
    // second storage
    source: "67a143d162f5371cbb7bb49b",
    // main south link
    sink: "6799f5bad11320315980dc99",
    sourceCondition: (storage: StructureStorage) => storage.store.getUsedCapacity(RESOURCE_ENERGY) > 20000
  }
};

export function muleSpawnLoop(): boolean {
  const mules = _.filter(Game.creeps, creep => creep.memory.role === "mule");
  const muleCounts: Record<string, number> = {};
  for (const mule of mules) {
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

export function muleLoop(creep: Creep): void {
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    creep.memory.status = "withdraw";
  }
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
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
  if (creep.memory.status === "withdraw") {
    const source = Game.getObjectById<StructureStorage>(pathDef.source);
    if (source == null) {
      console.log(`Unknown source ${pathDef.source}`);
      return;
    }
    if (pathDef.sourceCondition != null && !pathDef.sourceCondition(source)) {
      if (!moveToIdleSpot(creep)) {
        creep.moveTo(source, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
      return;
    }
    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
    }
    return;
  }

  // Deposit to sink
  const sink = Game.getObjectById<StructureStorage>(pathDef.sink);
  if (sink == null) {
    console.log(`Unknown sink ${pathDef.sink}`);
    return;
  }
  if (creep.transfer(sink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
    creep.moveTo(sink, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
  }
}
