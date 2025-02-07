interface UpgraderNoMoveMemory extends CreepMemory {
  role: "upgrader-nomove";
  status: "upgrading" | "withdrawing" | "moving";
  upgradePos: RoomPosition;
}

export type UpgraderNoMoveCreep = Creep & {
  memory: UpgraderNoMoveMemory;
};

export function isUpgraderNoMove(creep: Creep): creep is UpgraderNoMoveCreep {
  return creep.memory.role === "upgrader-nomove";
}
