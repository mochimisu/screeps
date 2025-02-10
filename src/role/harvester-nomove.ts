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
    const target = getClosestEnergyStorageInNeed(creep, 3);
    if (target) {
      const harvesterNoMoveSourcePos = creep.memory.harvesterNoMoveSourcePos;
      if (harvesterNoMoveSourcePos && target.pos.getRangeTo(harvesterNoMoveSourcePos) > 3) {
        // Don't go so far
        return;
      }
      for (const resourceType in creep.store) {
        if (creep.transfer(target, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
          return;
        }
      }
    }
  }
}
