import { getAllRooms } from "./room";

declare global {
  interface Memory {
    repairManager: {
      [roomName: string]: {
        creepRepairTargets: Id<Structure>[];
        towerRepairTargets: Id<Structure>[];
      };
    };
  }
}

interface ThresholdDef {
  min: number;
  repairTo: number;
  towerMin: number;
}
const repairThresholds: Partial<Record<StructureConstant, ThresholdDef>> = {
  [STRUCTURE_WALL]: { min: 300_000, repairTo: 1_000_000, towerMin: 100 },
  [STRUCTURE_RAMPART]: { min: 80_000, repairTo: 100_000, towerMin: 1_000 }
};
const defaultRepairPercents: { min: number; repairTo: number; towerMin: number } = {
  min: 0.8,
  repairTo: 0.9,
  towerMin: 0.5
};

export function shouldCreepRepairStructure(structure: Structure): boolean {
  const threshDef = repairThresholds[structure.structureType];
  if (threshDef) {
    return structure.hits < threshDef.min;
  } else {
    return structure.hits / structure.hitsMax < defaultRepairPercents.min;
  }
}

export function shouldCreepContinueRepairing(structure: Structure): boolean {
  const threshDef = repairThresholds[structure.structureType];
  if (threshDef) {
    return structure.hits < threshDef.repairTo;
  } else {
    return structure.hits / structure.hitsMax < defaultRepairPercents.repairTo;
  }
}

export function creepRepairPercent(structure: Structure): number {
  const threshDef = repairThresholds[structure.structureType];
  if (threshDef) {
    return (structure.hits - threshDef.min) / (threshDef.repairTo - threshDef.min);
  } else {
    return structure.hits / structure.hitsMax / defaultRepairPercents.repairTo;
  }
}

export function shouldTowerRepairStructure(structure: Structure): boolean {
  const threshDef = repairThresholds[structure.structureType];
  if (threshDef) {
    return structure.hits < threshDef.towerMin;
  } else {
    return structure.hits / structure.hitsMax < defaultRepairPercents.towerMin;
  }
}

export function towerRepairPercent(structure: Structure): number {
  const threshDef = repairThresholds[structure.structureType];
  if (threshDef) {
    return (structure.hits - threshDef.min) / (threshDef.towerMin - threshDef.min);
  } else {
    return structure.hits / structure.hitsMax / defaultRepairPercents.towerMin;
  }
}

function getRepairMemory() {
  if (Memory.repairManager == null) {
    Memory.repairManager = {};
  }
  return Memory.repairManager;
}

function updateRoom(room: Room): void {
  const structures = room.find(FIND_STRUCTURES, {
    filter: s => s.hits < s.hitsMax
  });
  const creepRepairTargets = _.sortBy(structures.filter(shouldCreepRepairStructure), creepRepairPercent);
  const towerRepairTargets = _.sortBy(structures.filter(shouldTowerRepairStructure), towerRepairPercent);
  const repairMemory = getRepairMemory();
  repairMemory[room.name] = {
    creepRepairTargets: creepRepairTargets.map(s => s.id),
    towerRepairTargets: towerRepairTargets.map(s => s.id)
  };
}

export function getCreepRepairTargetIds(roomName: string): Id<Structure>[] {
  return getRepairMemory()[roomName]?.creepRepairTargets ?? [];
}

export function getTowerRepairTargetIds(roomName: string): Id<Structure>[] {
  return getRepairMemory()[roomName]?.towerRepairTargets ?? [];
}

export function managerRepairLoop(): void {
  const rooms = getAllRooms();
  const checkInterval = 10;
  if (Game.time % checkInterval !== 0) {
    return;
  }
  const amortizedTick = Game.time / checkInterval;
  const room = rooms[amortizedTick % rooms.length];
  updateRoom(room);
}
