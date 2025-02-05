interface MuleMemory extends CreepMemory {
  role: "mule";
  status: "withdraw" | "deposit";
  path: string;
}

export type MuleCreep = Creep & {
  memory: MuleMemory;
};

export function isMule(creep: Creep): creep is MuleCreep {
  return creep.memory.role === "mule";
}

export interface MulePath {
  numMules: number;
  source: string;
  sink: string;
  sourceCondition?: (storage: StructureStorage) => boolean;
}
