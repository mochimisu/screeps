import { goToRoomAssignment } from "manager/room";
import { ReserverCreep } from "./reserver.type";

export function reserverLoop(creep: ReserverCreep) {
  if (goToRoomAssignment(creep)) {
    return;
  }
  if (creep.room.controller == null) {
    console.log("No controller in room: " + creep.room.name);
    return;
  }
  const reserveStatus = creep.reserveController(creep.room.controller);
  if (reserveStatus === ERR_NOT_IN_RANGE) {
    creep.moveTo(creep.room.controller);
  } else if (reserveStatus === ERR_NOT_OWNER || reserveStatus === ERR_INVALID_TARGET) {
    creep.attackController(creep.room.controller);
  }
}
