import { goToRoomAssignment } from "manager/room";
import { DefenderMeleeCreep, DefenderRangedCreep } from "./role.defenders.type";
import { moveToIdleSpot } from "manager/idle";
import { getMemoryDefense } from "./defense";

export function defenderRoamingLoop(creep: DefenderMeleeCreep | DefenderRangedCreep) {
  const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
  if (target) {
    if (creep.attack(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
    }
    if (creep.rangedAttack(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
    }
  } else {
    const strategy = creep.memory.roomName ? getMemoryDefense().strategy[creep.memory.roomName] : null;
    const idleSpot = strategy?.type === "roaming-remote-simple" ? strategy?.idleSpot : null;
    if (idleSpot == null) {
      moveToIdleSpot(creep, creep.memory.roomName);
    } else {
      const target = new RoomPosition(idleSpot.x, idleSpot.y, creep.memory.roomName ?? creep.room.name);
      creep.moveTo(target, {
        visualizePathStyle: { stroke: "#ff0000" },
        reusePath: 10
      });
    }
  }
}
