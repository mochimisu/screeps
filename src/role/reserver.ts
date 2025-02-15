import { goToRoomAssignment } from "manager/room";
import { ReserverCreep } from "./reserver.type";
import { setReplaceAtForCurrentTick } from "utils/replace-at";

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
    creep.moveTo(controller);
  } else if (reserveStatus === ERR_NOT_OWNER || reserveStatus === ERR_INVALID_TARGET) {
    creep.attackController(controller);
  } else if (reserveStatus === OK && creep.memory.replaceAt == null && creep.memory.born) {
    setReplaceAtForCurrentTick(creep, 30);
  }
}
