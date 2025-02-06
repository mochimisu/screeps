import { getEnergy } from "manager/energy";
import { moveToIdleSpot } from "manager/idle";
import { goToRoomAssignment } from "manager/room";
import { RepairerCreep, isRepairer } from "./repairer.type";

const repairThresholds: { [structureType: string]: [number, number] } = {
  [STRUCTURE_WALL]: [4000, 6000],
  [STRUCTURE_RAMPART]: [6000, 10000]
};
const defaultRepairPercents: [number, number] = [0.8, 0.9];

export function repairerLoop(creep: RepairerCreep): void {
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "get-energy";
  } else {
    creep.memory.status = "repair";
  }

  if (creep.memory.status === "get-energy") {
    if (getEnergy(creep)) {
      creep.say("🔄 energy");
      return;
    }
  }

  if (creep.memory.status === "repair") {
    if (goToRoomAssignment(creep)) {
      return;
    }

    const repairTargets = creep.room.find(FIND_STRUCTURES, {
      filter: structure => {
        for (const [type, thresholds] of Object.entries(repairThresholds)) {
          if (structure.structureType === type) {
            return structure.hits < thresholds[0];
          }
        }
        return structure.hits / structure.hitsMax < defaultRepairPercents[0];
      }
    });
    creep.say(`🔧${repairTargets.length}`);
    if (creep.memory.targetId) {
      const target = Game.getObjectById<Structure>(creep.memory.targetId);
      if (!target) {
        creep.memory.targetId = null;
        return;
      }
      const hitsMax = repairThresholds[target.structureType] ? repairThresholds[target.structureType][1] : null;
      const percent = Math.round((target.hits / target.hitsMax) * 100);
      creep.say(`🔧${percent}% ${repairTargets.length}`);
      if (
        (hitsMax != null && target.hits / hitsMax > defaultRepairPercents[1]) ||
        target.hits / target.hitsMax > defaultRepairPercents[1]
      ) {
        creep.memory.targetId = null;
      }
      if (target) {
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: "#ffffff" }
          });
        }
        return;
      } else {
        creep.memory.targetId = null;
      }
      return;
    } else {
      const targets = repairTargets.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
      // Find targets already assigned to other repairers
      const repairers = _.filter(Game.creeps, c => isRepairer(c)) as RepairerCreep[];
      const repairerTargets = new Set(repairers.map(r => r.memory.targetId));
      while (targets.length > 0) {
        const target = targets.shift();
        if (target && !repairerTargets.has(target.id)) {
          creep.memory.targetId = target.id;
          return;
        }
      }
      // if all claimed, just go to nearest
      const nearestTarget = targets[0];
      if (nearestTarget) {
        creep.memory.targetId = nearestTarget.id;
        return;
      }
    }
  }
  moveToIdleSpot(creep);
}
