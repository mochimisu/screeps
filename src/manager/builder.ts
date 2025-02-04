import { getAllRooms, goToRoom } from "./room";
import { getBufferConstructionSites } from "./energy";

const maxBuilding = 16;

if (!Memory.builderManager == null) {
  Memory.builderManager = {
    sources: {}
  };
}

const maxOverrides: { [sourceId: string]: number } = {};

const priority = new Set([
  "6796afb38f30f500125d4fea",
  "6796afb78f30f500125d4fec",
  "6796afb58f30f500125d4feb",
  "6796afb522e342001278ed03",
  "6796afb622e342001278ed04"
]);

export function getMaxCapacity(target: ConstructionSite): number {
  if (target.id in maxOverrides) {
    return maxOverrides[target.id];
  }
  return maxBuilding;
}

export function findBuildTarget(creep: Creep): ConstructionSite | null {
  const sources = creep.room.find(FIND_CONSTRUCTION_SITES);

  // Sort sources by distance from the creep
  const sortedSources = _.sortBy(sources, source => creep.pos.getRangeTo(source));
  const prioritySources = sortedSources.filter(source => priority.has(source.id));
  const energyConstructionSites = getBufferConstructionSites();

  prioritySources.push(...energyConstructionSites);

  for (const source of prioritySources) {
    if (isBuildTargetFull(source)) {
      if (Memory.builderManager.sources[source.id].includes(creep.name)) {
        return source;
      }
      continue;
    }
    return source;
  }
  for (const source of sortedSources) {
    if (isBuildTargetFull(source)) {
      if (Memory.builderManager.sources[source.id].includes(creep.name)) {
        return source;
      }
      continue;
    }
    return source;
  }
  return null;
}

export function updateStatus(creep: Creep, sourceId: string, isBuilding: boolean): void {
  if (!Memory.builderManager.sources[sourceId]) {
    Memory.builderManager.sources[sourceId] = [];
  }
  if (isBuilding) {
    if (!Memory.builderManager.sources[sourceId].includes(creep.name)) {
      Memory.builderManager.sources[sourceId].push(creep.name);
    }
  } else {
    Memory.builderManager.sources[sourceId] = Memory.builderManager.sources[sourceId].filter(e => e !== creep.name);
  }
}

export function isBuildTargetFull(source: ConstructionSite): boolean {
  if (source.id in Memory.builderManager.sources) {
    return Memory.builderManager.sources[source.id].length >= getMaxCapacity(source);
  }
  return false;
}

export function onCreepDeath(creepName: string): void {
  for (const sourceId in Memory.builderManager.sources) {
    Memory.builderManager.sources[sourceId] = Memory.builderManager.sources[sourceId].filter(e => e !== creepName);
  }
}

export function clearCreep(creep: Creep): void {
  if (creep.memory.builderManager && creep.memory.builderManager.lastSource) {
    updateStatus(creep, creep.memory.builderManager.lastSource, false);
  }
}

export function reset(): void {
  Memory.builderManager.sources = {};
}

export function buildClosestNode(creep: Creep): boolean {
  if (creep.memory.builderManager == null) {
    creep.memory.builderManager = {};
  }
  clearCreep(creep);
  if (creep.memory.builderManager.lastSource) {
    creep.memory.builderManager.lastSource = null;
  }

  if (creep.store.getUsedCapacity() === 0) {
    return false;
  }

  const target = findBuildTarget(creep);
  if (target) {
    if (creep.build(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#aaff00" } });
    }
    creep.memory.builderManager.lastSource = target.id;
    updateStatus(creep, target.id, true);
    return true;
  }
  // if no target in here, check if there is a target in a wip room
  for (const room of getAllRooms()) {
    if (room.find(FIND_CONSTRUCTION_SITES).length > 0) {
      if (goToRoom(creep, room.name)) {
        return true;
      }
    }
  }

  return false;
}

module.exports = {
  buildClosestNode,
  onCreepDeath,
  reset,
  clearCreep
};
