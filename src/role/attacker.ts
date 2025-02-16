import { moveToIdleSpot } from "manager/idle";
import { goToRoomAssignment } from "manager/room";

import { AttackerCreep } from "./attacker.type";

const targetStructures: Set<[number, number]> = new Set([
  // [13, 45],
  // [14, 45],
  // [15, 45],
  // [16, 45],
]);

export function attackerLoop(creep: AttackerCreep): void {
  let active = false;
  if (goToRoomAssignment(creep)) {
    return;
  }
  const creepTarget = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
  // console.log("creepName", creep.name);
  // console.log("creepTarget", creepTarget);
  if (creepTarget) {
    active = true;
    if (creep.attack(creepTarget) === ERR_NOT_IN_RANGE) {
      creep.moveTo(creepTarget);
    }
    if (creep.rangedAttack(creepTarget) === ERR_NOT_IN_RANGE) {
      creep.moveTo(creepTarget);
    }
  } else {
    const structures = [];
    for (const [x, y] of targetStructures) {
      const targets = creep.room.lookAt(x, y);
      const structTarget = targets.find(t => t.type === "structure");
      if (structTarget) {
        structures.push(structTarget.structure);
      }
    }
    const sortedStructures = _.sortBy(structures, s => s && creep.pos.getRangeTo(s));
    const structAtkTarget = sortedStructures[0];

    if (structAtkTarget) {
      const attackStatus = creep.attack(structAtkTarget);
      creep.say(`🔫${structAtkTarget.pos.x},${structAtkTarget.pos.y}`);
      if (attackStatus === ERR_NOT_IN_RANGE) {
        creep.moveTo(structAtkTarget);
      } else if (attackStatus === OK) {
        return;
      }
    }
  }
  if (!active) {
    creep.say("🛌");
    moveToIdleSpot(creep);
  }
}
