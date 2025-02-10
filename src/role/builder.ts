import { getEnergy } from "manager/energy";
import { clearCreep } from "manager/harvester";
import { moveToIdleSpot } from "manager/idle";
import { goToMainRoom, goToRoomAssignment } from "manager/room";
import { BuilderCreep, isBuilder } from "./builder.type";
import { spawnInRoom } from "manager/spawn";

const numBuilders = 4;
const minSitePerBuilder = 3;

export function builderSpawnLoop(): void {
  const builders = _.filter(Game.creeps, isBuilder);
  const constructionSites = _.filter(Game.constructionSites, cs => cs.my);
  const desiredBuilders = Math.min(Math.ceil(constructionSites.length / minSitePerBuilder), numBuilders);
  if (builders.length < desiredBuilders) {
    spawnInRoom("builder", {
      assignToRoom: false,
      spawnElsewhereIfNeeded: true
    });
  }
}

export function buildClosestNode(creep: BuilderCreep): boolean {
  const constructionSites = _.filter(Game.constructionSites, cs => cs.my);
  const target = creep.pos.findClosestByPath(constructionSites);
  if (!target) {
    return false;
  }
  if (creep.build(target) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
  }
  return true;
}

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
    if (goToRoomAssignment(creep)) {
      return;
    }
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
      if (!goToRoomAssignment(creep)) {
        if (goToMainRoom(creep)) {
          return;
        }
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
