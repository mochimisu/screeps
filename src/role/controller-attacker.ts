import { goToRoomAssignment } from "manager/room";
import { ControllerAttackerCreep } from "./controller-attacker.type";
import { creepsByRoomAssignmentAndRole } from "utils/query";
import { spawnInRoom } from "manager/spawn";
import { bodyPart } from "utils/body-part";

declare global {
  interface Memory {
    controllerPosCache: {
      [roomName: string]: {
        xy: [number, number];
        distanceFromSpawn?: number;
        vulnerableAt?: number;
      };
    };
  }
}

// const roomsToAttack = ["W21S57"];
const roomsToAttack: string[] = [];

export function controllerAttackerSpawnLoop() {
  // Use main spawn only
  const spawn = Game.spawns["Spawn1"];
  if (!spawn) {
    return;
  }
  if (Memory.controllerPosCache == null) {
    Memory.controllerPosCache = {};
  }

  for (const roomName of roomsToAttack) {
    const creeps = creepsByRoomAssignmentAndRole(roomName, "controller-attacker");
    const vulnAt = Memory.controllerPosCache[roomName]?.vulnerableAt ?? 0;
    const travelDist = Memory.controllerPosCache[roomName]?.distanceFromSpawn ?? 0;
    const existingCreep = creeps[0];

    if (
      (vulnAt === 0 || Game.time + travelDist > vulnAt) &&
      (existingCreep == null || (existingCreep?.ticksToLive ?? 0) + Game.time < vulnAt)
    ) {
      // console.log(`Spawning controller-attacker for ${roomName}`);
      spawnInRoom("controller-attacker", {
        roomName,
        assignToRoom: true,
        spawnElsewhereIfNeeded: true,
        parts: [...bodyPart(CLAIM, 8), ...bodyPart(MOVE, 8)]
      });
    }
  }
}

export function controllerAttackerLoop(creep: ControllerAttackerCreep) {
  if (!creep.memory.roomName) {
    return;
  }
  const room = Game.rooms[creep.memory.roomName];
  const controller = room?.controller;
  if (!controller) {
    if (Memory.controllerPosCache[creep.memory.roomName] !== null) {
      const targetPos = new RoomPosition(
        Memory.controllerPosCache[creep.memory.roomName].xy[0],
        Memory.controllerPosCache[creep.memory.roomName].xy[1],
        creep.memory.roomName
      );
      creep.moveTo(targetPos, { reusePath: 20 });
      return;
    }
    goToRoomAssignment(creep);
    return;
  }
  if (Memory.controllerPosCache[creep.memory.roomName] == null) {
    Memory.controllerPosCache[creep.memory.roomName] = {
      xy: [controller.pos.x, controller.pos.y]
    };
  }
  if (creep.pos.inRangeTo(controller, 1)) {
    if (creep.memory.born) {
      Memory.controllerPosCache[creep.memory.roomName].distanceFromSpawn = Math.min(
        Game.time - creep.memory.born,
        Memory.controllerPosCache[creep.memory.roomName].distanceFromSpawn ?? 1000
      );
    }
    const reserveStatus = creep.reserveController(controller);
    if (reserveStatus === ERR_NOT_OWNER || reserveStatus === ERR_INVALID_TARGET) {
      if (creep.attackController(controller) === OK) {
        Memory.controllerPosCache[creep.memory.roomName].vulnerableAt = Game.time + 1000;
      }
    }
  } else {
    creep.moveTo(controller, { reusePath: 20 });
  }
}
