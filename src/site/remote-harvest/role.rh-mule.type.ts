interface RhMuleMemory extends CreepMemory {
  role: "rh-mule";
  status: "withdraw" | "deposit";
  rhSite: string;
  touchTransferTime?: number;
}

export type RhMuleCreep = Creep & {
  memory: RhMuleMemory;
};

export function isRhMule(creep: Creep): creep is RhMuleCreep {
  return creep.memory.role === "rh-mule";
}
