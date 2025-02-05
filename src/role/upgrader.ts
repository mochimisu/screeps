import { getEnergy } from "manager/energy";
import { moveToIdleSpot } from "manager/idle";
import { goToRoomAssignment } from "manager/room";
import { isUpgrader } from "./upgrader.type";

export function upgraderLoop(creep: Creep): void {
  if (!isUpgrader(creep)) {
    return;
  }
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "harvesting";
  }

  if (creep.store.getFreeCapacity() === 0) {
    creep.memory.status = "upgrading";
  }

  if (creep.memory.status == null) {
    creep.memory.status = "harvesting";
  }

  if (creep.memory.status === "harvesting") {
    if (!getEnergy(creep)) {
      moveToIdleSpot(creep);
    }
  } else if (creep.memory.status === "upgrading") {
    if (goToRoomAssignment(creep)) {
      return;
    }

    const controller = creep.room.controller;
    if (controller && creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, {
        visualizePathStyle: { stroke: "#ffffff" }
      });
    }
  }
}
