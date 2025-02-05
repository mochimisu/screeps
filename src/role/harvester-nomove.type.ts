interface HarvesterNoMoveMemory extends CreepMemory {
  role: "harvester-nomove";
  status: "harvesting" | "dumping";
  sourceId: string;
  harvesterNoMoveSourcePos?: RoomPosition;
}

export type HarvesterNoMoveCreep = Creep & {
  memory: HarvesterNoMoveMemory;
};

export function isHarvesterNoMove(creep: Creep): creep is HarvesterNoMoveCreep {
  return creep.memory.role === "harvester-nomove";
}
