import { mainRoom } from "manager/room";
import { EssDistributorCreep } from "./role.ess-distributor.type";
import { EssSiteDefinition, getSiteByName, getStorageStructures } from "./site";
import { getActiveResources, getNeededResources } from "market/orders";

function essGetSources(siteDef: EssSiteDefinition): (StructureContainer | StructureStorage | StructureLink)[] {
  const energySources: (StructureContainer | StructureStorage | StructureLink)[] = [];
  for (const posXY of siteDef.sources) {
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
  return energySources;
}

function essGetEnergy(siteDef: EssSiteDefinition, creep: EssDistributorCreep): boolean {
  // Get storage from energySources
  const energySources = essGetSources(siteDef).filter(s => s.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
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

function essGetMinerals(siteDef: EssSiteDefinition, creep: EssDistributorCreep): boolean {
  // look for minerals in source
  const mineralSources = essGetSources(siteDef).filter(s => {
    for (const resourceType in s.store) {
      if ((s.store.getUsedCapacity(resourceType as ResourceConstant) ?? 0) > 0) {
        return true;
      }
    }
    return false;
  });
  // Sort sources by distance from the creep
  const sortedSources = _.sortBy(mineralSources, source => creep.pos.getRangeTo(source));
  if (sortedSources.length === 0) {
    return false;
  }
  const target = sortedSources[0];
  for (const resourceType in target.store) {
    if (creep.withdraw(target, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
    }
    return true;
  }
  return false;
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
    if (
      structure.structureType === STRUCTURE_EXTENSION ||
      structure.structureType === STRUCTURE_SPAWN ||
      structure.structureType === STRUCTURE_TOWER
    ) {
      const structTyped = structure as StructureExtension | StructureSpawn | StructureTower;
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
  for (const resourceType in creep.store) {
    if (creep.transfer(target, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
    }
    return true;
  }
  return false;
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

  target = siteDef.sources[0];
  if (target) {
    creep.moveTo(target[0], target[1], {
      visualizePathStyle: { stroke: "#ffaa00" }
    });
    return;
  }
}

function essTerminalDeposit(siteDef: EssSiteDefinition, creep: Creep): boolean {
  const terminal = Game.rooms[siteDef.roomName].terminal;
  if (!terminal) {
    return essDepositEnergy(siteDef, creep);
  }
  const resourcesNeeded = getNeededResources();
  // deposit needed resources into terminal, anything else into storage
  for (const resourceTypeStr of resourcesNeeded.keys()) {
    const resourceType = resourceTypeStr;
    if (creep.store.getUsedCapacity(resourceType) > 0 && (resourcesNeeded.get(resourceType) ?? 0) > 0) {
      // console.log("depositing needed", resourceType, "into terminal");
      const amount = Math.min(creep.store.getUsedCapacity(resourceType), resourcesNeeded.get(resourceType) || 0);
      if (creep.transfer(terminal, resourceType, amount) === ERR_NOT_IN_RANGE) {
        creep.moveTo(terminal, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
      return true;
    }
  }

  // console.log("no resources needed");
  return essDepositEnergy(siteDef, creep);
}

function essTerminalTransfer(siteDef: EssSiteDefinition, creep: Creep): boolean {
  const terminal = Game.rooms[siteDef.roomName].terminal;
  if (!terminal) {
    return false;
  }

  const resourcesNeeded = getNeededResources();
  // console.log("resourcesNeeded", resourcesNeeded.size);

  // Grab anything we need from storage
  const storage = getStorageStructures(siteDef.roomName);
  for (const storageStructure of storage) {
    for (const resourceTypeStr of resourcesNeeded.keys()) {
      // console.log("looking for", resourceTypeStr);
      const resourceType = resourceTypeStr;
      const amount = Math.min(creep.store.getFreeCapacity(), resourcesNeeded.get(resourceType) || 0);
      if (storageStructure.store.getUsedCapacity(resourceType) > 0 && amount > 0) {
        // console.log("grabbing", resourceType, "from storage", amount);
        if (creep.withdraw(storageStructure, resourceType, amount) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storageStructure, {
            visualizePathStyle: { stroke: "#ffaa00" }
          });
        }
        return true;
      }
    }
  }

  // Get any overflow items from terminal
  const terminalResources = terminal.store;
  const activeResources = getActiveResources();
  for (const resourceTypeStr in terminalResources) {
    const resourceType = resourceTypeStr as ResourceConstant;
    const amountNeeded = activeResources.get(resourceType) || 0;
    const amountInTerminal = terminalResources[resourceType];
    if (amountInTerminal > amountNeeded) {
      const amount = Math.min(creep.store.getFreeCapacity(), amountInTerminal - amountNeeded);
      // console.log("grabbing overflow", resourceType, "from terminal", amount);
      if (creep.withdraw(terminal, resourceType, amount) === ERR_NOT_IN_RANGE) {
        creep.moveTo(terminal, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
      return true;
    }
  }
  return false;
}

export function distributorLoop(creep: EssDistributorCreep): void {
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "get-energy";
  }
  if (creep.store.getUsedCapacity() > 0) {
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
    } else if (essGetMinerals(essSiteDef, creep)) {
      return;
    }
    // run terminal loop if in main room
    if (creep.room.name === mainRoom) {
      essTerminalTransfer(essSiteDef, creep);
      return;
    }
  }
  if (creep.room.name === mainRoom && creep.memory.status === "deposit-energy") {
    if (essTerminalDeposit(essSiteDef, creep)) {
      return;
    }
  } else if (creep.memory.status === "deposit-energy") {
    if (essDepositEnergy(essSiteDef, creep)) {
      return;
    }
  }
  essIdle(essSiteDef, creep);
}
