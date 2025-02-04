import { goToMainRoom } from "manager/room";

export function claimerLoop(creep: Creep): void {
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
