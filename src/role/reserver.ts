import { goToRoomAssignment } from "manager/room";
import { setReplaceAtForCurrentTick } from "utils/replace-at";

import { ReserverCreep } from "./reserver.type";

export function reserverLoop(creep: ReserverCreep) {
  // has vis
  const room = Game.rooms[creep.memory.roomName];
  const controller = room?.controller;
  if (!controller) {
    if (goToRoomAssignment(creep)) {
      return;
    } else {
      console.log("No controller in room: " + creep.room.name);
      return;
    }
  }
  const reserveStatus = creep.reserveController(controller);
  if (reserveStatus === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, {
      reusePath: 20
    });
  } else if (reserveStatus === ERR_NOT_OWNER || reserveStatus === ERR_INVALID_TARGET) {
    creep.attackController(controller);
    //setReplaceAtForCurrentTick(creep, 0);
  } else if (reserveStatus === OK && creep.memory.replaceAt == null && creep.memory.born) {
    setReplaceAtForCurrentTick(creep, 30);
  }
}
