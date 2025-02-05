interface HarvesterMemory extends CreepMemory {
  role: "harvester";
  status: "harvesting" | "dumping";
  harvesterManager?: {
    lastSource?: string | null;
  };
  sourceId?: string;
}

export type HarvesterCreep = Creep & {
  memory: HarvesterMemory;
};

export function isHarvester(creep: Creep): creep is HarvesterCreep {
  return creep.memory.role === "harvester";
}
