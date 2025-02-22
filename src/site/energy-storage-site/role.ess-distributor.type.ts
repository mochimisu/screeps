interface EssDistributorMemory extends CreepMemory {
  role: "ess-distributor";
  status: "get-energy" | "deposit-energy";
  essSiteName?: string;
  wartime?: boolean;
}

export type EssDistributorCreep = Creep & {
  memory: EssDistributorMemory;
};

export function isEssDistributor(creep: Creep): creep is EssDistributorCreep {
  return creep.memory.role === "ess-distributor";
}
