import { EssSiteDefinition, getSiteByName } from "./site";

interface EssDistributorMemory extends CreepMemory {
  role: "ess-distributor";
  status: "get-energy" | "deposit-energy";
  essSiteName?: string;
}

export type EssDistributorCreep = Creep & {
  memory: EssDistributorMemory;
};

export function isEssDistributor(creep: Creep): creep is EssDistributorCreep {
  return creep.memory.role === "ess-distributor";
}

function essGetEnergy(siteDef: EssSiteDefinition, creep: Creep): boolean {
  // Get storage from energySources
  let energySources: (StructureContainer | StructureStorage | StructureLink)[] = [];
  for (const posXY of siteDef.energySources) {
    const pos = new RoomPosition(posXY[0], posXY[1], siteDef.roomName);
    const sources = pos
      .lookFor(LOOK_STRUCTURES)
      .filter(
        s =>
          s.structureType === STRUCTURE_CONTAINER ||
          s.structureType === STRUCTURE_STORAGE ||
          s.structureType === STRUCTURE_LINK
      ) as (StructureContainer | StructureStorage | StructureLink)[];
    energySources.push(...sources);
  }
  // Find any with energy
  energySources = energySources.filter(s => s.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
  // Sort sources by distance from the creep
  const sortedSources = _.sortBy(energySources, source => creep.pos.getRangeTo(source));
  if (sortedSources.length === 0) {
    return essGetStoredEnergy(siteDef, creep);
    // return false;
  }
  const target = sortedSources[0];
  const transferStatus = creep.withdraw(target, RESOURCE_ENERGY);
  if (transferStatus === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, {
      visualizePathStyle: { stroke: "#ffaa00" }
    });
  }
  return true;
}

function essGetStoredEnergy(siteDef: EssSiteDefinition, creep: Creep): boolean {
  // Get storage from storage structures if applicable
  // If we have any STRUCTURE_EXTENSION or STRUCTURE_SPAWN
  // that need energy in this area, get energy from storage
  const room = Game.rooms[siteDef.roomName];
  const structures = room.lookForAtArea(
    LOOK_STRUCTURES,
    siteDef.bounds[0][1],
    siteDef.bounds[0][0],
    siteDef.bounds[1][1],
    siteDef.bounds[1][0],
    true
  );
  if (siteDef.storage.length === 0) {
    return false;
  }
  const storageStructure = room
    .lookAt(siteDef.storage[0][0], siteDef.storage[0][1])
    .filter(
      s =>
        s.structure &&
        (s.structure.structureType === STRUCTURE_STORAGE || s.structure.structureType === STRUCTURE_CONTAINER)
    )
    .map(s => s.structure)[0];
  if (!storageStructure) {
    return false;
  }
  for (const obj of structures) {
    const structure = obj.structure;
    if (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) {
      const structTyped = structure as StructureExtension | StructureSpawn;
      const store = structTyped.store;
      if (store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        const transferStatus = creep.withdraw(storageStructure, RESOURCE_ENERGY);
        if (transferStatus === ERR_NOT_IN_RANGE) {
          creep.moveTo(storageStructure, {
            visualizePathStyle: { stroke: "#ffaa00" }
          });
        }
        return true;
      }
    }
  }
  return false;
}

function essDepositEnergy(siteDef: EssSiteDefinition, creep: Creep): boolean {
  // Deposit energy into, in order of importance:
  // 1. Spawn
  // 2. Extensions
  // 3. Towers
  // 4. Storage/Containers
  const importanceOrder = [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE];
  const room = Game.rooms[siteDef.roomName];
  const structures = room.lookForAtArea(
    LOOK_STRUCTURES,
    siteDef.bounds[0][1],
    siteDef.bounds[0][0],
    siteDef.bounds[1][1],
    siteDef.bounds[1][0],
    true
  );
  let targets: Structure[] = [];
  for (const structureType of importanceOrder) {
    targets = structures
      .map(s => s.structure)
      .filter(
        s => s.structureType === structureType && (s as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
      );
    if (targets.length > 0) {
      break;
    }
  }

  // Find closest
  const sortedTargets = _.sortBy(targets, t => creep.pos.getRangeTo(t));
  if (sortedTargets.length === 0) {
    return false;
  }
  const target = sortedTargets[0];
  const transferStatus = creep.transfer(target, RESOURCE_ENERGY);
  if (transferStatus === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, {
      visualizePathStyle: { stroke: "#ffaa00" }
    });
  }
  return true;
}

function essIdle(siteDef: EssSiteDefinition, creep: Creep): void {
  // Idle
  let target = siteDef.storage[0];
  if (target) {
    creep.moveTo(target[0], target[1], {
      visualizePathStyle: { stroke: "#ffaa00" }
    });
    return;
  }

  target = siteDef.energySources[0];
  if (target) {
    creep.moveTo(target[0], target[1], {
      visualizePathStyle: { stroke: "#ffaa00" }
    });
    return;
  }
}

export function distributorLoop(creep: Creep): void {
  if (!isEssDistributor(creep)) {
    return;
  }
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "get-energy";
  }
  if (creep.store.getFreeCapacity() === 0) {
    creep.memory.status = "deposit-energy";
  }

  const essAreaName = creep.memory.essSiteName;
  const essSiteDef = essAreaName && getSiteByName(essAreaName);
  if (!essSiteDef) {
    console.log("ERROR: No room definition found for", essAreaName);
    return;
  }

  if (creep.memory.status === "get-energy") {
    if (essGetEnergy(essSiteDef, creep)) {
      return;
    }
  }
  if (creep.memory.status === "deposit-energy") {
    if (essDepositEnergy(essSiteDef, creep)) {
      return;
    }
  }
  essIdle(essSiteDef, creep);
}
