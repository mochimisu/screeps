import { HarvesterCreep } from "role/harvester";
import { goToRoom } from "./room";
import { HarvesterNoMoveCreep } from "role/harvester-nomove";

const maxHarvesting = 5;

if (!Memory.harvesterManager) {
  Memory.harvesterManager = {
    sources: {}
  };
}

const maxOverrides: { [sourceId: string]: number } = {};

const noMoveHarvestNodes: {
  [sourceId: string]: number;
} = {
  // main
  "5bbcabba9099fc012e6342c6": 1,
  "5bbcabba9099fc012e6342c5": 1,
  // 2nd
  "5bbcabba9099fc012e6342c8": 1
};

export function getMaxCapacity(source: Source): number {
  const id = source.id;
  if (id in noMoveHarvestNodes) {
    return 0;
  }
  if (id in maxOverrides) {
    return maxOverrides[source.id];
  }
  return maxHarvesting;
}

export function findHarvestNode(creep: Creep): Source | null {
  let sources = creep.room.find(FIND_SOURCES);

  sources = sources.filter(source => source.energy > 0);

  // Sort sources by distance from the creep
  const sortedSources = _.sortBy(sources, source => creep.pos.getRangeTo(source));

  // Iterate through the sorted sources
  for (const source of sortedSources) {
    if (isHarvestNodeFull(source)) {
      if (Memory.harvesterManager.sources[source.id].includes(creep.name)) {
        return source;
      }
      continue;
    }
    return source;
  }
  return null;
}

export function findHarvestNodeNoMove(creep: Creep): Source | null {
  // Find if we're already in one
  for (const sourceId in noMoveHarvestNodes) {
    const existingCreeps = Memory.harvesterManager.sources[sourceId];
    if (existingCreeps == null) {
      continue;
    }
    if (existingCreeps.includes(creep.name)) {
      return Game.getObjectById(sourceId);
    }
  }

  // Find one with a spot
  for (const sourceId in noMoveHarvestNodes) {
    if (isHarvestNodeNoMoveFull(sourceId)) {
      continue;
    }
    return Game.getObjectById(sourceId);
  }

  // None
  return null;
}

export function updateStatus(creep: Creep, sourceId: string, isHarvesting: boolean): void {
  if (!Memory.harvesterManager.sources[sourceId]) {
    Memory.harvesterManager.sources[sourceId] = [];
  }
  if (isHarvesting) {
    if (!Memory.harvesterManager.sources[sourceId].includes(creep.name)) {
      Memory.harvesterManager.sources[sourceId].push(creep.name);
    }
  } else {
    Memory.harvesterManager.sources[sourceId] = Memory.harvesterManager.sources[sourceId].filter(e => e !== creep.name);
  }
}

export function isHarvestNodeFull(source: Source): boolean {
  if (source.id in Memory.harvesterManager.sources) {
    return Memory.harvesterManager.sources[source.id].length >= getMaxCapacity(source);
  }
  return false;
}

export function isHarvestNodeNoMoveFull(sourceId: string): boolean {
  if (sourceId in Memory.harvesterManager.sources) {
    return Memory.harvesterManager.sources[sourceId].length >= noMoveHarvestNodes[sourceId];
  }
  return false;
}

export function onCreepDeath(creepName: string): void {
  for (const sourceId in Memory.harvesterManager.sources) {
    Memory.harvesterManager.sources[sourceId] = Memory.harvesterManager.sources[sourceId].filter(e => e !== creepName);
  }
}

export function clearCreep(creep: Creep): void {
  if (creep.memory.harvesterManager && creep.memory.harvesterManager?.lastSource) {
    updateStatus(creep, creep.memory.harvesterManager.lastSource, false);
  }
}

export function reset(): void {
  Memory.harvesterManager.sources = {};
}

export function harvestNoMove(creep: HarvesterNoMoveCreep): boolean {
  if (creep.store.getFreeCapacity() < 10) {
    return false;
  }
  const source = findHarvestNodeNoMove(creep);
  if (source == null) {
    return false;
  }
  creep.memory.sourceId = source.id;
  creep.memory.roomName = source.room.name;
  if (source) {
    updateStatus(creep, source.id, true);
    if (source.room.name !== creep.room.name) {
      goToRoom(creep, source.room.name);
      return true;
    }

    creep.memory.harvesterNoMoveSourcePos = source.pos;
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    return true;
  }
  return false;
}

export function harvestClosestNode(creep: Creep): boolean {
  if (creep.memory.harvesterManager == null) {
    creep.memory.harvesterManager = {};
  }
  clearCreep(creep);
  creep.memory.harvesterManager.lastSource = null;

  if (creep.store.getFreeCapacity() === 0) {
    return false;
  }

  const source = findHarvestNode(creep);
  if (source == null) {
    return false;
  }
  if (source) {
    updateStatus(creep, source.id, true);
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      creep.memory.harvesterManager.lastSource = source.id;
      return true;
    }
  }
  return false;
}

export function numNoMoveHarvestNodes(): number {
  let sum = 0;
  for (const source in noMoveHarvestNodes) {
    sum += noMoveHarvestNodes[source];
  }
  return sum;
}
