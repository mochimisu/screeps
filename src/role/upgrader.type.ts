interface UpgraderMemory extends CreepMemory {
  role: "upgrader";
  status: "harvesting" | "upgrading";
}

export type UpgraderCreep = Creep & {
  memory: UpgraderMemory;
};

export function isUpgrader(creep: Creep): creep is UpgraderCreep {
  return creep.memory.role === "upgrader";
}
