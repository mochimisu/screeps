import { goToRoomAssignment } from "manager/room";
import { getRhHarvester, getSiteByName } from "./site";
import { RhMuleCreep } from "./role.rh-mule.type";

export function rhMuleLoop(creep: RhMuleCreep): void {
  if (creep.store.getFreeCapacity() === 0) {
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
