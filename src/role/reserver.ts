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
  if (creep.reserveController(creep.room.controller) === ERR_NOT_IN_RANGE) {
    creep.moveTo(creep.room.controller);
  }
}
