import { getActiveResources, getNeededResources } from "market/orders";

import { EssDistributorCreep, isEssDistributor } from "./role.ess-distributor.type";
import {
  EssSiteDefinition,
  getDesiredResourcesForOtherSites,
  getExcessResourcesInTerminal,
  getExtraResources,
  getNeededResourcesInTerminal,
  getSiteByName,
  getStorageStructures
} from "./site";
import { keywiseAdd } from "utils/etc";
import { compact } from "lodash";

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
  }
  const target = sortedSources[0];
  if (target.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
    const transferStatus = creep.withdraw(target, RESOURCE_ENERGY);
    if (transferStatus === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
    }
    return true;
  }
  return false;
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
    .map(s => s.structure)[0] as StructureStorage | StructureContainer;
  if (!storageStructure) {
    return false;
  }
  if (storageStructure.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
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
        // console.log("essGetStoredEnergy2", siteDef.roomName);
        return true;
      }
    }
  }
  return false;
}

function essDepositEnergy(siteDef: EssSiteDefinition, creep: Creep, disallowStorage?: boolean): boolean {
  // Deposit energy into, in order of importance:
  // 1. Spawn
  // 2. Extensions
  // 3. Towers
  // 4. Storage/Containers
  const importanceOrder = compact([
    STRUCTURE_TOWER,
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    disallowStorage ? null : STRUCTURE_STORAGE
  ]);
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
    if (isEssDistributor(creep) && creep.memory.wartime) {
      targets = targets.filter(
        s => s.structureType !== STRUCTURE_TOWER || (s as StructureTower).store.getUsedCapacity(RESOURCE_ENERGY) < 500
      );
    }
    if (targets.length > 0) {
      break;
    }
  }

  // todo: fix: if we have any non energy, deposit into storage
  if (
    !disallowStorage &&
    creep.store.getUsedCapacity(RESOURCE_ENERGY) !== creep.store.getUsedCapacity() &&
    creep.store.getUsedCapacity() > 0
  ) {
    const storage = getStorageStructures(siteDef.roomName)[0];
    if (storage) {
      for (const resourceType in creep.store) {
        if (creep.transfer(storage, resourceType as ResourceConstant) === ERR_NOT_IN_RANGE) {
          creep.moveTo(storage, {
            visualizePathStyle: { stroke: "#ffaa00" }
          });
        }
        return true;
      }
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
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && essDepositEnergy(siteDef, creep, true)) {
    return true;
  }

  const neededInTerminal = getNeededResourcesInTerminal(siteDef.roomName);
  for (const [resourceTypeStr, amountNeeded] of Object.entries(neededInTerminal)) {
    const resourceType = resourceTypeStr as ResourceConstant;
    if (creep.store.getUsedCapacity(resourceType) > 0 && amountNeeded > 0) {
      const amount = Math.min(creep.store.getUsedCapacity(resourceType), amountNeeded);
      // console.log("essTerminalDeposit", siteDef.roomName, resourceType, amount);
      if (creep.transfer(terminal, resourceType, amount) === ERR_NOT_IN_RANGE) {
        creep.moveTo(terminal, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
      return true;
    }
  }
  return essDepositEnergy(siteDef, creep);
}

export function essTerminalTransfer(siteDef: EssSiteDefinition, creep: Creep): boolean {
  // console.log("essTerminalTransfer", siteDef.roomName);
  const terminal = Game.rooms[siteDef.roomName].terminal;
  if (!terminal) {
    return false;
  }

  const neededInTerminal = getNeededResourcesInTerminal(siteDef.roomName);
  // console.log("neededInTerminal", siteDef.roomName, JSON.stringify(neededInTerminal, null, 2));
  // Grab from storage
  const storage = getStorageStructures(siteDef.roomName);
  for (const storageStructure of storage) {
    for (const [resourceTypeStr, amountNeeded] of Object.entries(neededInTerminal)) {
      const resourceType = resourceTypeStr as ResourceConstant;
      const amount = Math.min(creep.store.getFreeCapacity(), amountNeeded);
      if (storageStructure.store.getUsedCapacity(resourceType) > 0 && amount > 0) {
        if (
          creep.withdraw(
            storageStructure,
            resourceType,
            Math.min(amount, storageStructure.store.getUsedCapacity(resourceType))
          ) === ERR_NOT_IN_RANGE
        ) {
          creep.moveTo(storageStructure, {
            visualizePathStyle: { stroke: "#ffaa00" }
          });
        }
        return true;
      }
    }
  }

  const excessInTerminal = getExcessResourcesInTerminal(siteDef.roomName);
  // Grab from terminal
  // console.log("excessInTerminal", siteDef.roomName, JSON.stringify(excessInTerminal, null, 2));
  for (const [resourceTypeStr, amountInTerminal] of Object.entries(excessInTerminal)) {
    const resourceType = resourceTypeStr as ResourceConstant;
    const amount = Math.min(creep.store.getFreeCapacity(), amountInTerminal);
    if (creep.withdraw(terminal, resourceType, amount) === ERR_NOT_IN_RANGE) {
      creep.moveTo(terminal, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
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
      // console.log("essGetEnergy", essSiteDef.roomName);
      return;
    } else if (essGetMinerals(essSiteDef, creep)) {
      // console.log("essGetMinerals", essSiteDef.roomName);
      return;
    }
    // run terminal loop if in main room
    if (essSiteDef.hasTerminal) {
      essTerminalTransfer(essSiteDef, creep);
      return;
    }
  }
  if (essSiteDef.hasTerminal && creep.memory.status === "deposit-energy") {
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
