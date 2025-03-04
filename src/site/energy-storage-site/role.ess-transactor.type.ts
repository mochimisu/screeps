interface EssTransactorMemory extends CreepMemory {
  role: "ess-transactor";
  status: "moving" | "get-resources" | "deposit-resources";
  essSiteName: string;
  idx?: number;
}

export type EssTransactorCreep = Creep & {
  memory: EssTransactorMemory;
};

export function isEssTransactor(creep: Creep): creep is EssTransactorCreep {
  return creep.memory.role === "ess-transactor";
}
