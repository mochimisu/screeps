import { goToRoomAssignment } from "manager/room";
import { getRhHarvester, getSiteByName } from "./site";
import { RhMuleCreep, isRhMule } from "./role.rh-mule.type";

export function rhMuleLoop(creep: RhMuleCreep): void {
  if (creep.store.getFreeCapacity() < 10) {
    creep.memory.status = "deposit";
  }
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "withdraw";
  }

  const rhSiteDef = getSiteByName(creep.memory.rhSite);
  if (!rhSiteDef) {
    console.log("No site found for mule: " + creep.name);
    return;
  }

  if (creep.memory.status === "deposit") {
    // Deposit into the sink
    const sink = Game.getObjectById<StructureStorage | StructureContainer | StructureLink>(rhSiteDef.sink);
    if (!sink) {
      console.log("No sink found for mule: " + creep.name);
      return;
    }
    // If there is another mule creep that is looking to withdraw, give it our stuff
    if (creep.memory.touchTransferTime == null || Game.time - creep.memory.touchTransferTime > 10) {
      const mulesTouching = creep.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: c => isRhMule(c) && c.memory.status === "withdraw"
      });
      if (mulesTouching.length > 0) {
        const mule = mulesTouching[0] as RhMuleCreep;
        for (const resourceType in creep.store) {
          if (creep.transfer(mule, resourceType as ResourceConstant) === OK) {
            creep.memory.status = "withdraw";
            creep.memory.touchTransferTime = Game.time;
            mule.memory.touchTransferTime = Game.time;
            // Rerun mule
            rhMuleLoop(mule);
            return;
          }
        }
      }
    }

    if (creep.transfer(sink, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(sink);
    }
  }

  if (creep.memory.status === "withdraw") {
    // Go to muleTransferPos if there's no one there, otherwise go to muleIdlePos
    const muleTransferPos = rhSiteDef.muleTransferPos();
    const muleIdlePos = rhSiteDef.muleIdlePos();

    if (muleTransferPos == null || muleIdlePos == null) {
      // No visibility, go to room
      if (goToRoomAssignment(creep)) {
        return;
      }
    }

    // If theres any dropped energy or tombstones with energy, grab those first
    const dropped = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: resource => resource.resourceType === RESOURCE_ENERGY
    });
    if (dropped.length > 0) {
      if (creep.pickup(dropped[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(dropped[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }
    const tombstones = creep.room.find(FIND_TOMBSTONES, {
      filter: tombstone => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombstones.length > 0) {
      if (creep.withdraw(tombstones[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(tombstones[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    try {
      const creepsAtMuleTransferPos = muleTransferPos.lookFor(LOOK_CREEPS);
      if (creepsAtMuleTransferPos.length === 0) {
        creep.moveTo(muleTransferPos);
        return;
      } else if (creepsAtMuleTransferPos[0].name === creep.name) {
        return;
      }
    } catch (e) {
      // console.log("Error in muleTransferPos: " + e);
    }
    creep.moveTo(muleIdlePos);
  }
}
