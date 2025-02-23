import { getEnergy } from "manager/energy";
import { DefenderRepairerCreep } from "./role.defenders.type";

export function defenderRepairerLoop(creep: DefenderRepairerCreep): void {
  // Repair weakest rampart
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    getEnergy(creep);
    return;
  }
  const ramparts = creep.room.find(FIND_STRUCTURES, {
    filter: structure => {
      return structure.structureType === STRUCTURE_RAMPART;
    }
  });
  // TODO better stickiness etc
  const target = _.min(ramparts, r => r.hits);
  if (target) {
    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  }
}
