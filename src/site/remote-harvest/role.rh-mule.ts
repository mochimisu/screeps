import { goToRoomAssignment } from "manager/room";
import { getRhHarvester, getSiteByName } from "./site";
import { RhMuleCreep, isRhMule } from "./role.rh-mule.type";

export function rhMuleLoop(creep: RhMuleCreep): void {
  if (creep.store.getFreeCapacity() < 50) {
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
    // Deposit into the closest valid sink with room
    let sinks = rhSiteDef.sinks
      .map(sinkId => Game.getObjectById<StructureStorage | StructureContainer | StructureLink>(sinkId))
      .filter(s => s != null && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) as (
      | StructureStorage
      | StructureContainer
      | StructureLink
    )[];
    sinks = _.sortBy(sinks, s => creep.pos.getRangeTo(s));
    if (sinks.length === 0) {
      console.log("No sinks found for mule: " + creep.name);
      return;
    }
    const sink = sinks[0];

    const transferStatus = creep.transfer(sink, RESOURCE_ENERGY);
    if (transferStatus === ERR_NOT_IN_RANGE) {
      creep.moveTo(sink, { reusePath: 10 });
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
    // If we have a structure at energyCachePos, grab from there
    if (rhSiteDef.energyCachePos) {
      const energyCachePos = rhSiteDef.energyCachePos();
      const energyCache = energyCachePos
        .lookFor(LOOK_STRUCTURES)
        .filter(
          s =>
            (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
            (s as StructureContainer | StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > 0
        )[0];
      if (energyCache) {
        if (creep.withdraw(energyCache, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(energyCache, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
        return;
      }
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
