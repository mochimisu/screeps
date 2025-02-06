import { getClosestEnergyStorageInNeed } from "manager/energy";
import { spawnInRoom } from "manager/spawn";
import { HarvesterNoMoveCreep, isHarvesterNoMove } from "./harvester-nomove.type";
import { getSiteResource } from "site/energy-storage-site/site";
import { noMoveNodes } from "./harvester-nomove.config";

export function harvesterNoMoveSpawnLoop(): boolean {
  // Count harvester-nomove by room
  const nomoveHarvesters = _.filter(Game.creeps, creep => creep.memory.role === "harvester-nomove");

  const nodesNeedingHarvesters = new Set(
    _.filter(Array.from(noMoveNodes.entries()), ([sourceId, predicate]) => {
      if (predicate) {
        return predicate();
      }
      return true;
    }).map(([sourceId, _]) => sourceId)
  );
  for (const harvester of nomoveHarvesters) {
    if (!isHarvesterNoMove(harvester)) {
      continue;
    }
    const sourceId = harvester.memory.sourceId;
    if (!sourceId) {
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
    if (
      spawnInRoom("harvester-nomove", {
        roomName,
        assignToRoom: true,
        spawnElsewhereIfNeeded: true,
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
  if (!isHarvesterNoMove(creep)) {
    return;
  }

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
    if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    return;
  } else if (creep.memory.status === "dumping") {
    const target = getClosestEnergyStorageInNeed(creep);
    if (target) {
      const harvesterNoMoveSourcePos = creep.memory.harvesterNoMoveSourcePos;
      if (harvesterNoMoveSourcePos && target.pos.getRangeTo(harvesterNoMoveSourcePos) > 2) {
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
