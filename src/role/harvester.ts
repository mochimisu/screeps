import { buildClosestNode } from "manager/builder";
import { getClosestEnergyStorageInNeed } from "manager/energy";
import { harvestClosestNode } from "manager/harvester";
import { HarvesterCreep, isHarvester } from "./harvester.type";

export function harvesterLoop(creep: HarvesterCreep): void {
  const memory = creep.memory;

  if (creep.store.getUsedCapacity() === 0) {
    memory.status = "harvesting";
  }

  if (creep.store.getFreeCapacity() < creep.getActiveBodyparts(WORK) * 2) {
    memory.status = "dumping";
  }

  if (memory.status == null) {
    memory.status = "harvesting";
  }

  if (creep.memory.status === "harvesting") {
    harvestClosestNode(creep);
  } else if (creep.memory.status === "dumping") {
    const target = getClosestEnergyStorageInNeed(creep, 10);
    if (target) {
      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    } else {
      creep.say("building");
    }
  }
}
