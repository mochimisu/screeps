import { buildClosestNode } from "manager/builder";
import { getClosestEnergyStorageInNeed } from "manager/energy";
import { harvestClosestNode } from "manager/harvester";

function isHarvesterMemory(memory: CreepMemory): memory is HarvesterMemory {
  return memory.role === "harvester";
}

export function harvesterLoop(creep: Creep): void {
  if (!isHarvesterMemory(creep.memory)) {
    return;
  }
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
      creep.memory.status = "idle-build";
    }
  }

  if (creep.memory.status === "idle-build") {
    const isBuilding = buildClosestNode(creep);
    if (!isBuilding) {
      creep.say("upgrading");
      creep.memory.status = "idle-upgrade";
    }
  }
  if (creep.memory.status === "idle-upgrade") {
    const controller = creep.room.controller;
    if (!controller) {
      return;
    }
    if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, {
        visualizePathStyle: { stroke: "#ffffff" }
      });
    }
  }
}
