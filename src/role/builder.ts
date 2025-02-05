import { buildClosestNode } from "manager/builder";
import { getEnergy } from "manager/energy";
import { clearCreep } from "manager/harvester";
import { moveToIdleSpot } from "manager/idle";
import { goToMainRoom } from "manager/room";
import { BuilderCreep, isBuilder } from "./builder.type";

export function builderLoop(creep: BuilderCreep): void {
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "harvesting";
  }

  if (creep.store.getFreeCapacity() === 0) {
    creep.memory.status = "building";
  }

  if (creep.memory.status == null) {
    creep.memory.status = "harvesting";
  }

  if (creep.memory.status === "harvesting") {
    if (!getEnergy(creep)) {
      moveToIdleSpot(creep);
    }
    clearCreep(creep);
  } else if (creep.memory.status === "building") {
    clearCreep(creep);
    // Find construction sites
    const isBuilding = buildClosestNode(creep);
    if (isBuilding) {
      creep.say("building");
    } else {
      if (creep.room.name === "W22S58") {
        // move to this spot to not crowd storage
        const targetPos = new RoomPosition(27, 18, "W22S58");
        if (creep.pos.getRangeTo(targetPos) > 2) {
          creep.moveTo(targetPos, {
            visualizePathStyle: { stroke: "#ffffff" }
          });
          return;
        }
      }
      // If no construction sites, upgrade the controller
      // (in main room)
      if (goToMainRoom(creep)) {
        return;
      }
      if (creep.room.controller == null) {
        return;
      }
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {
          visualizePathStyle: { stroke: "#ffffff" }
        });
      }
    }
  }
}
