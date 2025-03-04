import { queryId, queryIds } from "utils/query";
import { EssTransactorCreep } from "./role.ess-transactor.type";
import { EssSiteDefinition, getNeededResourcesInTerminal, getSiteByName } from "./site";
import { essTerminalTransfer } from "./role.ess-distributor";

function terminalNeedsResources(siteDef: EssSiteDefinition): boolean {
  const terminal = Game.rooms[siteDef.roomName].terminal;
  if (!terminal) {
    return false;
  }
  const neededInTerminal = getNeededResourcesInTerminal(siteDef.roomName);
  for (const [_, amount] of Object.entries(neededInTerminal)) {
    if (amount > 0) {
      return true;
    }
  }
  return false;
}

export function getTransactorNearbyEnergySources(
  siteDef: EssSiteDefinition,
  idx?: number
): (StructureContainer | StructureLink | StructureStorage)[] {
  const nearbyEnergySources = queryIds(
    `ess-${siteDef.name}-transactor-nearby-energy-sources`,
    () => {
      const sources: (StructureContainer | StructureLink | StructureStorage)[] = [];
      if (!siteDef.transactor) {
        return [];
      }
      const xy = siteDef.transactor[idx ?? 0];
      const pos = new RoomPosition(xy[0], xy[1], siteDef.roomName);
      const touchingEnergy = pos.findInRange(FIND_STRUCTURES, 1, {
        filter: s =>
          s.structureType === STRUCTURE_CONTAINER ||
          s.structureType === STRUCTURE_LINK ||
          s.structureType === STRUCTURE_STORAGE
      });
      // Sort: link > container > storage
      const links = touchingEnergy.filter(s => s.structureType === STRUCTURE_LINK) as StructureLink[];
      const containers = touchingEnergy.filter(s => s.structureType === STRUCTURE_CONTAINER) as StructureContainer[];
      const storages = touchingEnergy.filter(s => s.structureType === STRUCTURE_STORAGE) as StructureStorage[];
      sources.push(...links, ...containers, ...storages);
      return sources;
    },
    1000
  );
  if (!terminalNeedsResources(siteDef)) {
    return nearbyEnergySources.filter(s => s.structureType !== STRUCTURE_STORAGE);
  }
  return nearbyEnergySources;
}

export function getResources(creep: EssTransactorCreep): void {
  const siteDef = getSiteByName(creep.memory.essSiteName);
  const transactor = siteDef?.transactor;
  if (siteDef == null || transactor == null) {
    console.log(`siteDef or transactor not found for ${creep.memory.essSiteName}`);
    return;
  }
  const nearbyEnergy = getTransactorNearbyEnergySources(siteDef, creep.memory.idx);
  // check if any of these have energy
  for (const source of nearbyEnergy) {
    if (source.structureType === STRUCTURE_LINK) {
      if ((source as StructureLink).store[RESOURCE_ENERGY] > 0) {
        creep.withdraw(source, RESOURCE_ENERGY);
        return;
      }
    } else {
      for (const resourceType in source.store) {
        if (source.store.getUsedCapacity(resourceType as ResourceConstant) > 0) {
          creep.withdraw(source, resourceType as ResourceConstant);
          return;
        }
      }
    }
  }

  // if none have energy, do terminal withdraw
  essTerminalTransfer(siteDef, creep);
}

// todo share
function depositResources(siteDef: EssSiteDefinition, creep: EssTransactorCreep): boolean {
  const terminal = Game.rooms[siteDef.roomName].terminal;
  if (terminal) {
    const neededInTerminal = getNeededResourcesInTerminal(siteDef.roomName);
    for (const [resourceTypeStr, amountNeeded] of Object.entries(neededInTerminal)) {
      const resourceType = resourceTypeStr as ResourceConstant;
      if (creep.store.getUsedCapacity(resourceType) > 0 && amountNeeded > 0) {
        const amount = Math.min(creep.store.getUsedCapacity(resourceType), amountNeeded);
        // console.log("essTerminalDeposit", siteDef.roomName, resourceType, amount);
        creep.transfer(terminal, resourceType, amount);
        return true;
      }
    }
  }
  // Deposit into closest storage
  const idx = creep.memory.idx ?? 0;
  const transactorStorageDeposit = queryId(`ess-${siteDef.name}-transactor-storage-deposit-${idx}`, () => {
    const xy = siteDef.transactor?.[creep.memory.idx ?? 0];
    if (!xy) {
      return null;
    }
    const pos = new RoomPosition(xy[0], xy[1], siteDef.roomName);
    const storage = pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_STORAGE
    }) as StructureStorage | null;
    return storage;
  });
  if (!transactorStorageDeposit) {
    console.log(`transactorStorageDeposit not found for ${siteDef.name}`);
    return false;
  }
  if (creep.transfer(transactorStorageDeposit, RESOURCE_ENERGY) === OK) {
    return true;
  }
  return false;
}

export function essTransactorLoop(creep: EssTransactorCreep): void {
  if (!creep.memory.status) {
    creep.memory.status = "moving";
  }
  if (creep.memory.status === "moving") {
    const site = getSiteByName(creep.memory.essSiteName!);
    if (!site) {
      console.log(`site not found: ${creep.memory.essSiteName}`);
      return;
    }
    if (!site.transactor) {
      console.log(`site ${site.name} has no transactor`);
      return;
    }
    const targetPos = site.transactor[creep.memory.idx ?? 0];
    if (!targetPos) {
      console.log(`site ${site.name} has no transactor pos ${creep.memory.idx}`);
      return;
    }
    const targetRoomPos = new RoomPosition(targetPos[0], targetPos[1], site.roomName);
    if (creep.pos.isEqualTo(targetRoomPos)) {
      creep.memory.status = "get-resources";
    } else {
      creep.moveTo(targetRoomPos, { reusePath: 20 });
    }
  } else if (creep.memory.status === "get-resources") {
    getResources(creep);
    if (creep.store.getUsedCapacity() > 0) {
      creep.memory.status = "deposit-resources";
    }
  } else if (creep.memory.status === "deposit-resources") {
    depositResources(getSiteByName(creep.memory.essSiteName!), creep);
    if (creep.store.getUsedCapacity() === 0) {
      creep.memory.status = "get-resources";
    }
  }
}
