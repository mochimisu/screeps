interface JanitorMemory extends CreepMemory {
  role: "janitor";
  status: "collecting" | "dumping";
}

export type JanitorCreep = Creep & {
  memory: JanitorMemory;
};

export function isJanitor(creep: Creep): creep is JanitorCreep {
  return creep.memory.role === "janitor";
}
