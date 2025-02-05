import { goToMainRoom } from "manager/room";
import { ClaimerCreep } from "./claimer.type";

export function claimerLoop(creep: ClaimerCreep): void {
  if (goToMainRoom(creep)) {
    return;
  }
  creep.say("Claiming");
  // In the target room, move to the controller
  const controller = creep.room.controller;
  if (!controller) {
    return;
  }
  const claimStatus = creep.claimController(controller);
  if (claimStatus === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
  } else if (claimStatus !== OK) {
    creep.say(claimStatus.toString());
  }
}
