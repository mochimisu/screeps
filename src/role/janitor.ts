import { getEnergy } from "manager/energy";
import { moveToIdleSpot } from "manager/idle";
import { goToMainRoom, goToRoomAssignment } from "manager/room";
import { getEnergyContainersOutsideAreas, getStorageStructures } from "site/energy-storage-site/site";

export function janitorLoop(creep: Creep): void {
  if (creep.store.getFreeCapacity() === 0) {
    creep.memory.status = "dumping";
  } else if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "collecting";
  }
  if (creep.memory.status == null) {
    creep.memory.status = "collecting";
  }

  if (creep.memory.status === "collecting") {
    // Find dropped energy in the designated room
    if (goToRoomAssignment(creep)) {
      return;
    }
    const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: resource => resource.resourceType === RESOURCE_ENERGY
    });
    if (droppedEnergy && droppedEnergy.amount > 10) {
      if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
        creep.moveTo(droppedEnergy, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
      return;
    }

    const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
      filter: ts => ts.store[RESOURCE_ENERGY] > 0
    });
    if (tombstone) {
      // get all non energy resources first
      for (const resourceType in tombstone.store) {
        if (resourceType !== RESOURCE_ENERGY) {
          if (creep.withdraw(tombstone, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tombstone, {
              visualizePathStyle: { stroke: "#ffffff" }
            });
          }
          return;
        }
      }
      if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(tombstone, {
          visualizePathStyle: { stroke: "#ffffff" }
        });
      }
      return;
    }

    const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
      filter: r => r.store[RESOURCE_ENERGY] > 0
    });
    if (ruin) {
      if (creep.withdraw(ruin, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(ruin, {
          visualizePathStyle: { stroke: "#ffffff" }
        });
      }
      return;
    }

    // Pick up energy from containers outside energy site
    const containers = getEnergyContainersOutsideAreas(creep.room.name).filter(
      c => c.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    );
    if (containers.length > 0) {
      if (creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(containers[0], {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
      return;
    }

    // No energy to collect, dump if we have any energy
    if (creep.store.getUsedCapacity() > 0) {
      creep.memory.status = "dumping";
    }
  }

  if (creep.memory.status === "dumping") {
    // give the tower some energy
    const towers = creep.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (towers.length > 0) {
      // get energy
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        if (getEnergy(creep)) {
          return;
        }
      } else {
        const transferStatus = creep.transfer(towers[0], RESOURCE_ENERGY);
        if (transferStatus === ERR_NOT_IN_RANGE) {
          creep.moveTo(towers[0], {
            visualizePathStyle: { stroke: "#ffffff" }
          });
        }
        return;
      }
    } else if (creep.store.getUsedCapacity() > 0) {
      // const target = energyManager.getClosestEnergyStorageInNeed(creep);
      const targets = getStorageStructures(creep.room.name);
      const target = targets[0];
      if (target) {
        for (const resourceType in creep.store) {
          if (creep.transfer(target, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
              visualizePathStyle: { stroke: "#ffaa00" }
            });
          }
          return;
        }
        return;
      } else {
        // go home, probably can do something there
        goToMainRoom(creep);
        return;
      }
    }

    // If we still have energy to dump, but nowhere to dump, go to home room
    if (goToMainRoom(creep)) {
      return;
    }
  }

  // If nothing else, go to an idle spot
  moveToIdleSpot(creep);
}
