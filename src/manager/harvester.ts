import { HarvesterNoMoveCreep } from "role/harvester-nomove.type";
import { HarvesterCreep, isHarvester } from "role/harvester.type";
import { goToRoom } from "./room";
import { isNoMoveNode } from "role/harvester-nomove.config";

const maxHarvesting = 5;

if (!Memory.harvesterManager) {
  Memory.harvesterManager = {
    sources: {}
  };
}

const maxOverrides: { [sourceId: string]: number } = {};

export function getMaxCapacity(source: Source): number {
  const id = source.id;
  if (isNoMoveNode(id)) {
    return 0;
  }
  if (id in maxOverrides) {
    return maxOverrides[source.id];
  }
  return maxHarvesting;
}

export function findHarvestNode(creep: Creep): Source | null {
  let sources = creep.room.find(FIND_SOURCES);
  const extractors = creep.room.find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_EXTRACTOR);

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

export function onCreepDeath(creepName: string): void {
  for (const sourceId in Memory.harvesterManager.sources) {
    Memory.harvesterManager.sources[sourceId] = Memory.harvesterManager.sources[sourceId].filter(e => e !== creepName);
  }
}

export function clearCreep(creep: Creep): void {
  if (!isHarvester(creep)) {
    return;
  }
  if (creep.memory.harvesterManager && creep.memory.harvesterManager?.lastSource) {
    updateStatus(creep, creep.memory.harvesterManager.lastSource, false);
  }
}

export function reset(): void {
  Memory.harvesterManager.sources = {};
}

export function harvestClosestNode(creep: HarvesterCreep): boolean {
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
