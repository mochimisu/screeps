import { getClosestEnergyStorageInNeed } from "manager/energy";
import { goToMainRoom } from "manager/room";
import { moveToIdleSpot } from "manager/idle";

const targetStructures: Set<[number, number]> = new Set([
  // [13, 45],
  // [14, 45],
  // [15, 45],
  // [16, 45],
]);

export function attackerLoop(creep: Creep): void {
  let active = false;
  const creepTarget = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
  if (creepTarget) {
    active = true;
    if (creep.attack(creepTarget) === ERR_NOT_IN_RANGE) {
      creep.moveTo(creepTarget);
    }
  } else {
    if (goToMainRoom(creep)) {
      return;
    }
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

    // cleanup if idle
    if (creep.store.getFreeCapacity() > 0) {
      const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.resourceType === RESOURCE_ENERGY
      });
      if (droppedEnergy && droppedEnergy.amount > 10) {
        if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
          creep.moveTo(droppedEnergy, {
            visualizePathStyle: { stroke: "#ffaa00" }
          });
        }
        active = true;
      }
    }
    if (creep.store.getUsedCapacity() > 0) {
      const target = getClosestEnergyStorageInNeed(creep);
      if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, {
            visualizePathStyle: { stroke: "#ffaa00" }
          });
        }
        active = true;
      }
    }
  }
  if (!active) {
    moveToIdleSpot(creep);
  }
}
