import { bodyPart, spawnInRoom } from "manager/spawn";
import { UpgraderNoMoveCreep, isUpgraderNoMove } from "./upgrader-nomove.type";

export interface UpgraderSlotDef {
  xy: [number, number];
  parts?: BodyPartConstant[];
}

export const upgraderSlots: { [roomName: string]: UpgraderSlotDef[] } = {
  W22S58: [
    {
      xy: [30, 14],
      parts: [...bodyPart(WORK, 10), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 4)]
    }
  ],
  W22S59: [
    {
      xy: [27, 45],
      parts: [...bodyPart(WORK, 5), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 2)]
    }
  ]
};

export function upgraderNoMoveSpawnLoop() {
  const noMoveUpgraders = _.filter(Game.creeps, creep => isUpgraderNoMove(creep)) as UpgraderNoMoveCreep[];
  const availableSlots: { [roomName: string]: UpgraderSlotDef[] } = { ...upgraderSlots };
  for (const upgrader of noMoveUpgraders) {
    const upgraderPos = upgrader.memory.upgradePos;
    if (!upgraderPos) {
      continue;
    }
    availableSlots[upgraderPos.roomName] = availableSlots[upgraderPos.roomName].filter(curSlot => {
      return curSlot.xy[0] !== upgraderPos.x || curSlot.xy[1] !== upgraderPos.y;
    });
    if (availableSlots[upgraderPos.roomName].length === 0) {
      delete availableSlots[upgraderPos.roomName];
    }
  }

  for (const roomName in availableSlots) {
    const slots = availableSlots[roomName];
    for (const slot of slots) {
      if (
        spawnInRoom("upgrader-nomove", {
          roomName,
          assignToRoom: true,
          spawnElsewhereIfNeeded: true,
          additionalMemory: {
            upgradePos: new RoomPosition(slot.xy[0], slot.xy[1], roomName)
          },
          parts: slot.parts
        })
      ) {
        return true;
      }
    }
  }
  return false;
}

export function upgraderNoMoveLoop(creep: UpgraderNoMoveCreep): void {
  // Move if not in place
  const upgradePos = new RoomPosition(
    creep.memory.upgradePos.x,
    creep.memory.upgradePos.y,
    creep.memory.upgradePos.roomName
  );
  if (creep.pos.x !== upgradePos.x || creep.pos.y !== upgradePos.y || creep.pos.roomName !== upgradePos.roomName) {
    creep.memory.status = "moving";
  } else if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "withdrawing";
  } else {
    creep.memory.status = "upgrading";
  }

  if (creep.memory.status === "moving") {
    creep.moveTo(upgradePos, { visualizePathStyle: { stroke: "#ffffff" } });
    return;
  }

  if (creep.memory.status === "withdrawing") {
    // Find within 2 range
    const storage = creep.pos.findInRange(FIND_STRUCTURES, 2, {
      filter: structure => {
        return (
          (structure.structureType === STRUCTURE_STORAGE ||
            structure.structureType === STRUCTURE_CONTAINER ||
            structure.structureType === STRUCTURE_LINK) &&
          structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0
        );
      }
    })[0];
    if (storage) {
      if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  } else if (creep.memory.status === "upgrading") {
    if (creep.room.controller) {
      creep.upgradeController(creep.room.controller);
    }
  }
}
