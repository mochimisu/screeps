import { goToRoomAssignment } from "manager/room";
import { getSiteByName } from "./site";
import { RhHarvesterCreep } from "./role.rh-harvester.type";
import { setReplaceAtForCurrentTick } from "utils/replace-at";

export function rhHarvesterLoop(creep: RhHarvesterCreep): void {
  // Go to harvest location for the site
  const siteDef = getSiteByName(creep.memory.rhSite);
  if (!siteDef) {
    console.log("No site found for harvester: " + creep.name);
    return;
  }

  if (creep.memory.status == null) {
    creep.memory.status = "moving";
  }
  if (creep.memory.status === "moving") {
    const targetPos = siteDef.harvestPos();
    if (!targetPos) {
      // No visibility, go to room
      if (goToRoomAssignment(creep)) {
        return;
      }
    }
    if (creep.pos.getRangeTo(targetPos) < 1) {
      creep.memory.status = "harvesting";
      setReplaceAtForCurrentTick(creep);
    } else {
      creep.moveTo(targetPos);
    }
  }
  if (creep.memory.status === "harvesting") {
    const source = Game.getObjectById<Source>(siteDef.source);
    if (!source) {
      console.log("No source found for harvester: " + creep.name);
      return;
    }
    if (creep.store.getFreeCapacity() < creep.getActiveBodyparts(WORK) * 2) {
      // If there is a container or storage at energycachepos, give it our stuff
      if (siteDef.energyCachePos) {
        const energyCachePos = siteDef.energyCachePos();
        const energyCache = energyCachePos
          .lookFor(LOOK_STRUCTURES)
          .filter(s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE)[0];
        if (energyCache) {
          for (const resourceType in creep.store) {
            if (creep.transfer(energyCache, resourceType as ResourceConstant) === OK) {
              return;
            }
          }
        }
      }

      // otherwise, If there is a creep in the mule transfer pos, give it our stuff
      const muleTransferPos = siteDef.muleTransferPos();
      if (muleTransferPos.lookFor(LOOK_CREEPS).length > 0) {
        const muleCreep = muleTransferPos.lookFor(LOOK_CREEPS)[0];
        if (!muleCreep) {
          console.log("No creep found at mule transfer pos");
          creep.say("🙄");
          return;
        }
        if (muleCreep.owner.username !== creep.owner.username) {
          console.log("Creep at mule transfer pos is not ours");
          return;
        }
        for (const resourceType in creep.store) {
          if (creep.transfer(muleCreep, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
            creep.moveTo(muleCreep);
            return;
          }
        }
      }
      return;
    }
    const harvestResult = creep.harvest(source);
    if (harvestResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(source);
    }
  }
}
