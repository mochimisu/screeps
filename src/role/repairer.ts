import { getEnergy } from "manager/energy";
import { moveToIdleSpot } from "manager/idle";
import { goToRoomAssignment, mainRoom } from "manager/room";
import { RepairerCreep, isRepairer } from "./repairer.type";
import { creepsByRoomAssignmentAndRole } from "utils/query";
import {
  creepRepairPercent,
  getCreepRepairTargetIds,
  shouldCreepContinueRepairing,
  shouldCreepRepairStructure
} from "manager/repair";

function getUnassignedRepair(creep: RepairerCreep): Structure | null {
  const roomName = creep.memory.roomName ?? creep.room.name;
  const takenTargets = new Set(
    creepsByRoomAssignmentAndRole(roomName, creep.memory.role).map(c => (c as RepairerCreep).memory.targetId)
  );
  for (const targetId of getCreepRepairTargetIds(roomName)) {
    const structure = Game.getObjectById(targetId);
    if (structure && shouldCreepRepairStructure(structure) && !takenTargets.has(targetId)) {
      return structure;
    }
  }
  return null;
}

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
    const room = Game.rooms[creep.memory.roomName ?? mainRoom];
    if (!room) {
      if (goToRoomAssignment(creep)) {
        return;
      }
    }

    const numRepairTargets = getCreepRepairTargetIds(room.name).length;
    creep.say(`🔧${numRepairTargets}`);
    if (creep.memory.targetId) {
      const target = Game.getObjectById<Structure>(creep.memory.targetId);
      if (!target) {
        creep.memory.targetId = null;
        return;
      }
      const pct = Math.round(creepRepairPercent(target) * 100);
      creep.say(`🔧${pct}% ${numRepairTargets}`);
      if (!shouldCreepContinueRepairing(target)) {
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
      const target = getUnassignedRepair(creep);
      if (target) {
        creep.memory.targetId = target.id;
        return;
      }
    }
  }
  moveToIdleSpot(creep);
}
