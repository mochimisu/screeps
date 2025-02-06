interface RhHarvesterMemory extends CreepMemory {
  role: "rh-harvester";
  status: "harvesting" | "moving";
  rhSite: string;
  sourceId: string;
}

export type RhHarvesterCreep = Creep & {
  memory: RhHarvesterMemory;
};

export function isRhHarvester(creep: Creep): creep is RhHarvesterCreep {
  return creep.memory.role === "rh-harvester";
}
