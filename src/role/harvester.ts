import { buildClosestNode } from "manager/builder";
import { getClosestEnergyStorageInNeed } from "manager/energy";
import { harvestClosestNode } from "manager/harvester";

export function harvesterLoop(creep: Creep): void {
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
