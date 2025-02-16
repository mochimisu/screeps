import { getEnergy } from "manager/energy";
import { clearCreep } from "manager/harvester";
import { moveToIdleSpot } from "manager/idle";
import { goToMainRoom, goToRoomAssignment, mainRoom } from "manager/room";
import { spawnInRoom } from "manager/spawn";
import { getCachedSiteResource } from "site/energy-storage-site/site";

import { BuilderCreep, isBuilder } from "./builder.type";

const numBuilders = 3;
const progressPerBuilder = 1000;
const reqEnergyPerBuilder = 5000;

// interface DenyArea {
//   start: { x: number; y: number };
//   end: { x: number; y: number };
// }

// const denyAreas: { [roomName: string]: DenyArea } = {
//   W22S58: {
//     start: { x: 30, y: 13 },
//     end: { x: 32, y: 15 }
//   }
// };

export function builderSpawnLoop(): void {
  const builders = _.filter(Game.creeps, isBuilder);
  const constructionSites = _.filter(Game.constructionSites, cs => cs.my);
  const totalProgressNeeded = _.sum(constructionSites, cs => cs.progressTotal);
  const capFromEnergy = Math.ceil(getCachedSiteResource(mainRoom, RESOURCE_ENERGY) / reqEnergyPerBuilder);
  const desiredBuilders = Math.max(
    Math.min(Math.ceil(totalProgressNeeded / progressPerBuilder), numBuilders),
    capFromEnergy
  );
  // console.log("totalProgressNeeded", totalProgressNeeded);
  // console.log("desiredBuilders", desiredBuilders);
  if (builders.length < desiredBuilders) {
    spawnInRoom("builder", {
      assignToRoom: false,
      spawnElsewhereIfNeeded: true
    });
  }
}

export function buildClosestNode(creep: BuilderCreep): boolean {
  if (creep.memory.builderLastTarget != null) {
    const lastTarget = Game.getObjectById<ConstructionSite>(creep.memory.builderLastTarget);
    // if we are in a denyarea move out of it
    // if (denyAreas[creep.room.name] != null) {
    //   const denyArea = denyAreas[creep.room.name];
    //   if (
    //     creep.pos.x >= denyArea.start.x &&
    //     creep.pos.x <= denyArea.end.x &&
    //     creep.pos.y >= denyArea.start.y &&
    //     creep.pos.y <= denyArea.end.y
    //   ) {
    //     if (creep.room.controller) {
    //       // go in a random direction
    //       const direction = Math.floor(Math.random() * 8);
    //       const randomDir = new RoomPosition(
    //         creep.pos.x + (direction % 3) - 1,
    //         creep.pos.y + Math.floor(direction / 3) - 1,
    //         creep.room.name
    //       );
    //       creep.moveTo(randomDir, { visualizePathStyle: { stroke: "#ffffff" } });
    //       return true;
    //     }
    //   }
    // }
    if (lastTarget != null && lastTarget.progress < lastTarget.progressTotal) {
      const buildStatus = creep.build(lastTarget);
      if (buildStatus === ERR_NOT_IN_RANGE) {
        creep.moveTo(lastTarget, { visualizePathStyle: { stroke: "#ffffff" } });
        return true;
      } else if (buildStatus === OK) {
        return true;
      }
    }
  }
  // find closest
  const myConstructionSites = _.filter(Game.constructionSites, cs => cs.my);
  // do roads first
  const roads = _.filter(myConstructionSites, cs => cs.structureType === STRUCTURE_ROAD);
  const targets = _.sortBy(roads.length > 0 ? roads : myConstructionSites, cs => creep.pos.getRangeTo(cs));
  const target = targets[0];
  if (!target) {
    return false;
  }
  creep.memory.builderTargetValid = creep.pos.getRangeTo(target) < 10000;
  if (creep.build(target) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
  }
  creep.memory.builderLastTarget = target.id;
  return true;
}

export function builderLoop(creep: BuilderCreep): void {
  if (creep.store.getUsedCapacity() === 0 || creep.memory.status == null) {
    creep.memory.status = "harvesting";
  }

  if (creep.store.getFreeCapacity() === 0) {
    if (creep.memory.status !== "building") {
      creep.memory.status = "building";
      creep.memory.builderLastTarget = undefined;
    }
  }
  if (creep.room.name !== creep.memory.builderLastRoom) {
    creep.memory.builderLastRoom = creep.room.name;
    if (!creep.memory.builderTargetValid) {
      creep.memory.builderLastTarget = undefined;
    }
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
