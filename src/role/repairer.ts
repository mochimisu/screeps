import { getEnergy } from "manager/energy";
import { moveToIdleSpot } from "manager/idle";
import {
  creepRepairPercent,
  getCreepRepairTargetIds,
  shouldCreepContinueRepairing,
  shouldCreepRepairStructure
} from "manager/repair";
import { getAllRoomNames, goToRoomAssignment, mainRoom } from "manager/room";
import { spawnInRoom } from "manager/spawn";
import { creepsByRoomAssignmentAndRole } from "utils/query";

import { RepairerCreep } from "./repairer.type";

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

export function repairerSpawnLoop(): boolean {
  // Spawn 1 repairer per room.
  // Spawn an additional repairer for every 100 needed repairs.
  const numRepairersByRoom: { [roomName: string]: number } = {};
  for (const roomName of getAllRoomNames()) {
    numRepairersByRoom[roomName] = 1;
    const additionalRepairs = Math.floor(getCreepRepairTargetIds(roomName).length / 100);
    numRepairersByRoom[roomName] += additionalRepairs;
  }
  for (const roomName in numRepairersByRoom) {
    const numExisting = creepsByRoomAssignmentAndRole(roomName, "repairer").length;
    if (numExisting < numRepairersByRoom[roomName]) {
      if (
        spawnInRoom("repairer", {
          roomName,
          assignToRoom: true,
          spawnElsewhereIfNeeded: true
        })
      ) {
        return true;
      }
    }
  }
  return false;
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
