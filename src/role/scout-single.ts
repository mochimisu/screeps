import { goToRoomAssignment } from "manager/room";
import { ScoutSingleCreep } from "./scout-single.type";

export function scoutSingleLoop(creep: ScoutSingleCreep): void {
  if (goToRoomAssignment(creep)) {
    return;
  }
  // if along wall step in
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
  if (creep.pos.y === 49) {
    creep.move(TOP);
    return;
  }
}
