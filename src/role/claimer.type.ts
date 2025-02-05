interface ClaimerMemory extends CreepMemory {
  role: "claimer";
}

export type ClaimerCreep = Creep & {
  memory: ClaimerMemory;
};

export function isClaimer(creep: Creep): creep is ClaimerCreep {
  return creep.memory.role === "claimer";
}
