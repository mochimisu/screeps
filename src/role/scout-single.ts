import { goToRoomAssignment } from "manager/room";
import { ScoutSingleCreep } from "./scout-single.type";

export function scoutSingleLoop(creep: ScoutSingleCreep): void {
  goToRoomAssignment(creep);
}
