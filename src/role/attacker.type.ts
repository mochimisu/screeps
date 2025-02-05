interface AttackerMemory extends CreepMemory {
  role: "attacker";
}

export type AttackerCreep = Creep & {
  memory: AttackerMemory;
};

export function isAttacker(creep: Creep): creep is AttackerCreep {
  return creep.memory.role === "attacker";
}
