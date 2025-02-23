import { getMemoryAttack } from "attack/attack";
import { AttackTowerDrainDismantlerCreep, AttackTowerDrainHealerCreep } from "./role.type";
import { goToRoom, goToRoomAssignment } from "manager/room";
import { moveToIdleSpot } from "manager/idle";
import { creepToRally, tankMoveCostCallback } from "./simple-tower-drain";

export function atdHealerLoop(creep: AttackTowerDrainHealerCreep): void {
  const attackMemory = getMemoryAttack();
  if (creep.memory.roomName == null) {
    return;
  }
  const strategy = attackMemory[creep.memory.roomName];
  if (strategy?.type !== "simple-tower-drain") {
    return;
  }
  const status = strategy.status;
  if (
    status?.phase === "drain" ||
    status?.phase === "dismantle" ||
    status?.phase === "complete" ||
    status?.phase === "attack"
  ) {
    if (creep.hits / creep.hitsMax < 0.5) {
      creepToRally(creep, strategy);
      return;
    }
    if (goToRoomAssignment(creep)) {
      return;
    }
    // Move off the edge of the room
    if (creep.pos.x === 0) {
      creep.move(RIGHT);
      return;
    }
    if (creep.pos.x === 49) {
      creep.move(LEFT);
      return;
    }
    if (creep.pos.y === 0) {
      creep.move(BOTTOM);
      return;
    }
    if (creep.pos.y > 48) {
      // move to any of the 3 squares up, look if there is another creep there though
      const positions = [
        new RoomPosition(creep.pos.x, 47, creep.room.name),
        new RoomPosition(creep.pos.x - 1, 47, creep.room.name),
        new RoomPosition(creep.pos.x + 1, 47, creep.room.name)
      ];
      for (const pos of positions) {
        if (pos.lookFor(LOOK_CREEPS).length === 0) {
          creep.moveTo(pos);
          return;
        }
      }

      return;
    }

    // Heal the lowest health creep in this room
    const creeps = creep.room.find(FIND_MY_CREEPS, {
      filter: c => c.hits < c.hitsMax
    });
    const target = _.min(creeps, c => c.hits);
    if (target) {
      if (creep.heal(target) === ERR_NOT_IN_RANGE) {
        if (status?.phase === "drain") {
          creep.moveTo(target, { costCallback: tankMoveCostCallback(strategy) });
        } else {
          creep.moveTo(target);
        }
      }
      return;
    }
  } else {
    creepToRally(creep, strategy);
  }
}
