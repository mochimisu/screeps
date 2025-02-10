interface BuilderMemory extends CreepMemory {
  role: "builder";
  status: "harvesting" | "building";
  builderLastTarget?: string;
}

export type BuilderCreep = Creep & {
  memory: BuilderMemory;
};

export function isBuilder(creep: Creep): creep is BuilderCreep {
  return creep.memory.role === "builder";
}
