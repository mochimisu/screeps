import { getMemoryAttack } from "attack/attack";
import { AttackTowerDrainDismantlerCreep } from "./role.type";
import { goToRoom, goToRoomAssignment } from "manager/room";
import { moveToIdleSpot } from "manager/idle";
import { creepToRally } from "./simple-tower-drain";

export function atdDismantlerLoop(creep: AttackTowerDrainDismantlerCreep): void {
  const attackMemory = getMemoryAttack();
  if (creep.memory.roomName == null) {
    return;
  }
  const strategy = attackMemory[creep.memory.roomName];
  if (strategy?.type !== "simple-tower-drain") {
    return;
  }
  const status = strategy.status;
  if (status?.phase === "dismantle" || status?.phase === "complete") {
    if (creep.hits / creep.hitsMax < 0.5) {
      creepToRally(creep, strategy);
      return;
    }
    if (goToRoomAssignment(creep)) {
      return;
    }
    // Find things to dismantle in order:
    // 1. Specified ramparts
    // 2. Towers
    // 3. Spawn
    // 4. Anything else
    const specifiedRampartPos = strategy.targetRamparts;
    const ramparts = specifiedRampartPos?.map(pos => pos.lookFor(LOOK_STRUCTURES)[0]).filter(s => s != null);
    if (ramparts) {
      const target = creep.pos.findClosestByRange(ramparts);
      if (target) {
        if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
        return;
      }
    }

    const room = Game.rooms[creep.memory.roomName];
    const towers = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    });
    if (towers.length > 0) {
      const target = creep.pos.findClosestByRange(towers);
      if (target) {
        if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
        return;
      }
    }

    const spawns = room.find(FIND_HOSTILE_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_SPAWN
    });
    if (spawns.length > 0) {
      const target = creep.pos.findClosestByRange(spawns);
      if (target) {
        if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
        return;
      }
    }

    const otherStructures = room.find(FIND_HOSTILE_STRUCTURES);
    if (otherStructures.length > 0) {
      const target = creep.pos.findClosestByRange(otherStructures);
      if (target) {
        if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
        return;
      }
    }
  } else {
    creepToRally(creep, strategy);
  }
}
