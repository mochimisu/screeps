import { getClosestEnergyStorageInNeed } from "manager/energy";
import { spawnInRoom } from "manager/spawn";
import { HarvesterNoMoveCreep, isHarvesterNoMove } from "./harvester-nomove.type";
import { getSiteResource } from "site/energy-storage-site/site";
import { noMoveNodes, noMoveNodesById } from "./harvester-nomove.config";
import { setReplaceAtForCurrentTick } from "utils/replace-at";

export function harvesterNoMoveSpawnLoop(): boolean {
  // Count harvester-nomove by room
  const nomoveHarvesters = _.filter(Game.creeps, creep => creep.memory.role === "harvester-nomove");

  const nodesNeedingHarvesters = new Set(
    _.filter(noMoveNodes, ({ predicate }) => {
      if (predicate) {
        return predicate();
      }
      return true;
    }).map(({ sourceId }) => sourceId)
  );
  for (const harvester of nomoveHarvesters) {
    if (!isHarvesterNoMove(harvester)) {
      continue;
    }
    const sourceId = harvester.memory.sourceId;
    if (!sourceId) {
      continue;
    }
    if (harvester.memory.replaceAt != null && harvester.memory.replaceAt < Game.time) {
      continue;
    }

    nodesNeedingHarvesters.delete(sourceId);
  }

  for (const nodeId of nodesNeedingHarvesters) {
    const roomName = Game.getObjectById<Source>(nodeId)?.room.name;
    if (!roomName) {
      console.log("No room found for node: " + nodeId);
      continue;
    }
    const def = noMoveNodesById.get(nodeId);
    if (
      spawnInRoom("harvester-nomove", {
        roomName,
        assignToRoom: true,
        spawnElsewhereIfNeeded: def?.allowOtherRoomSpawn ?? false,
        additionalMemory: {
          sourceId: nodeId
        }
      })
    ) {
      return true;
    }
  }
  return false;
}

function harvesterDumpTarget(
  creep: HarvesterNoMoveCreep,
  hasNonEnergy: boolean
): StructureContainer | StructureLink | StructureStorage | StructureSpawn | null {
  if (creep.memory.harvesterDumpTargets == null) {
    // Find structures within 2 spaces
    const targets = creep.pos.findInRange(FIND_STRUCTURES, 2, {
      filter: s =>
        (s.structureType === STRUCTURE_CONTAINER ||
          s.structureType === STRUCTURE_LINK ||
          s.structureType === STRUCTURE_STORAGE ||
          s.structureType === STRUCTURE_SPAWN) &&
        (s?.store?.getFreeCapacity(RESOURCE_ENERGY) ?? 0) > 0
    });
    // Sort in priority order:
    const spawns = targets.filter(t => t.structureType === STRUCTURE_SPAWN);
    const links = hasNonEnergy ? targets.filter(t => t.structureType === STRUCTURE_LINK) : [];
    const containers = targets.filter(t => t.structureType === STRUCTURE_CONTAINER);
    const storages = targets.filter(t => t.structureType === STRUCTURE_STORAGE);
    const sortedTargets = [...spawns, ...links, ...containers, ...storages];
    creep.memory.harvesterDumpTargets = sortedTargets.map(t => t.id);
  }
  for (const targetId of creep.memory.harvesterDumpTargets ?? []) {
    const target = Game.getObjectById(targetId) as
      | StructureContainer
      | StructureLink
      | StructureStorage
      | StructureSpawn;
    if (!target) {
      // Target is gone, clear memory.
      creep.memory.harvesterDumpTargets = undefined;
    }
    if ((target.store.getFreeCapacity() ?? 0) > 0) {
      return target;
    } else if (target instanceof StructureLink && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      return target;
    }
  }
  return null;
}

export function harvesterNoMoveLoop(creep: HarvesterNoMoveCreep): void {
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "harvesting";
  }

  if (creep.store.getFreeCapacity() < creep.getActiveBodyparts(WORK) * 2) {
    creep.memory.status = "dumping";
  }

  if (creep.memory.status == null) {
    creep.memory.status = "harvesting";
  }

  if (creep.memory.status === "harvesting") {
    const sourceId = creep.memory.sourceId;
    if (!sourceId) {
      console.log("No sourceId found for harvester-nomove: " + creep.name);
      return;
    }
    const target = Game.getObjectById<Source>(sourceId);
    if (!target) {
      console.log(`No target found for harvester-nomove: ${sourceId}`);
      return;
    }
    const roomName = target.room.name;
    if (creep.room.name !== roomName) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
      return;
    }
    const harvestStatus = creep.harvest(target);
    if (harvestStatus === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
    } else if (harvestStatus === OK && creep.memory.replaceAt == null && creep.memory.born) {
      setReplaceAtForCurrentTick(creep);
    }
    return;
  } else if (creep.memory.status === "dumping") {
    const hasNonEnergy = creep.store.getUsedCapacity() !== creep.store.getUsedCapacity(RESOURCE_ENERGY);
    const dumpTarget = harvesterDumpTarget(creep, hasNonEnergy);
    if (dumpTarget) {
      for (const resourceType in creep.store) {
        if (creep.transfer(dumpTarget, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
          creep.moveTo(dumpTarget, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
        return;
      }
    }
  }
}
