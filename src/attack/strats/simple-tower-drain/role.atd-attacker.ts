import { getMemoryAttack } from "attack/attack";
import { AttackTowerDrainAttackerCreep, AttackTowerDrainDismantlerCreep } from "./role.type";
import { goToRoom, goToRoomAssignment } from "manager/room";
import { moveToIdleSpot } from "manager/idle";
import { creepToRally } from "./simple-tower-drain";

export function atdAttackerLoop(creep: AttackTowerDrainAttackerCreep): void {
  const attackMemory = getMemoryAttack();
  if (creep.memory.roomName == null) {
    return;
  }
  const strategy = attackMemory[creep.memory.roomName];
  if (strategy?.type !== "simple-tower-drain") {
    return;
  }
  const status = strategy.status;
  if (status?.phase === "dismantle" || status?.phase === "complete" || status?.phase === "attack") {
    if (creep.hits / creep.hitsMax < 0.5) {
      creepToRally(creep, strategy);
      return;
    }
    if (creep.room.name !== creep.memory.roomName) {
      creep.moveTo(new RoomPosition(25, 25, creep.memory.roomName));
    }

    // Attack creeps
    const creepTarget = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
    if (creepTarget) {
      if (creep.attack(creepTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creepTarget);
      }
      if (creep.rangedAttack(creepTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creepTarget);
      }
      return;
    }

    // Attack structures
    const structureTarget = creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);
    if (structureTarget) {
      if (creep.rangedAttack(structureTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(structureTarget);
      }
      return;
    }
  } else {
    creepToRally(creep, strategy);
  }
}
