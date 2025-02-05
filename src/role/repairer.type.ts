interface RepairerMemory extends CreepMemory {
  role: "repairer";
  status: "get-energy" | "repair";
  targetId?: string | null;
}

export type RepairerCreep = Creep & {
  memory: RepairerMemory;
};

export function isRepairer(creep: Creep): creep is RepairerCreep {
  return creep.memory.role === "repairer";
}
