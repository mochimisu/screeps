interface DismantlerMemory extends CreepMemory {
  role: "dismantler";
}

export type DismantlerCreep = Creep & {
  memory: DismantlerMemory;
};

export function isDismantler(creep: Creep): creep is DismantlerCreep {
  return creep.memory.role === "dismantler";
}
