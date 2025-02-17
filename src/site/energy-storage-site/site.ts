// take energy from energySources and put it into storage

import { mainRoom } from "manager/room";
import { getNeededResources } from "market/orders";
import { bodyPart } from "utils/body-part";
import { keywiseSubtract, keywiseAdd, keywiseFilter } from "utils/etc";
import { creepsByRoomAssignmentAndRole, query, queryIds, structureTypesAtPos } from "utils/query";

export interface EssSiteDefinition {
  name: string;
  roomName: string;
  bounds: number[][];
  storage: number[][];
  sources: number[][];
  linkSinks?: number[][];
  distributors: number;
  distributorParts?: BodyPartConstant[];
  hasTerminal?: boolean;
  minResources?: Partial<Record<ResourceConstant, number>>;
}

const siteDefs: EssSiteDefinition[] = [
  {
    name: "main",
    roomName: "W22S58",
    bounds: [
      [2, 2],
      [39, 17]
    ],
    storage: [[31, 14]],
    sources: [[29, 12]],
    distributors: 1,
    distributorParts: [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 2)],
    hasTerminal: true,
    minResources: {
      [RESOURCE_ENERGY]: 100_000
    }
  },
  {
    name: "second",
    roomName: "W22S59",
    bounds: [
      [1, 7],
      [15, 29]
    ],
    storage: [[12, 19]],
    sources: [[6, 27]],
    linkSinks: [[26, 44]],
    distributors: 1,
    distributorParts: [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 2)],
    hasTerminal: true,
    minResources: {
      [RESOURCE_ENERGY]: 20_000
    }
  },
  {
    name: "third",
    roomName: "W21S58",
    bounds: [
      [20, 10],
      [39, 24]
    ],
    storage: [[29, 19]],
    sources: [[29, 17]],
    distributors: 1
  }
];

const sitesByRoom: { [roomName: string]: EssSiteDefinition[] } = {};
const sitesByName: { [name: string]: EssSiteDefinition } = {};
for (const siteDef of siteDefs) {
  if (sitesByRoom[siteDef.roomName] === undefined) {
    sitesByRoom[siteDef.roomName] = [];
  }
  sitesByRoom[siteDef.roomName].push(siteDef);
  sitesByName[siteDef.name] = siteDef;
}

export function getAllSiteDefs(): EssSiteDefinition[] {
  return siteDefs;
}

export function getUsedRooms(): string[] {
  return Object.keys(sitesByRoom);
}

export function getSiteResource(roomName: string, resourceName?: ResourceConstant): number {
  resourceName = resourceName || RESOURCE_ENERGY;
  const roomSites = sitesByRoom[roomName];
  if (!roomSites) {
    return 0;
  }
  return query(
    `ess-${roomName}-resource-${resourceName}`,
    () => {
      let count = 0;
      const storageStructures: (StructureStorage | StructureContainer | StructureTerminal | Creep)[] =
        getStorageStructures(roomName);
      const terminal = Game.rooms[roomName].terminal;
      if (terminal) {
        storageStructures.push(terminal);
      }
      storageStructures.push(...creepsByRoomAssignmentAndRole(roomName, "ess-distributor"));
      for (const storage of storageStructures) {
        count += storage.store[resourceName];
      }
      return count;
    },
    1
  );
}

export function getCachedSiteResource(roomName: string, resourceName?: ResourceConstant): number {
  return query(
    `ess-${roomName}-resource-${resourceName ?? ""}`,
    () => {
      return getSiteResource(roomName, resourceName);
    },
    10
  );
}

// Places to get or dump energy from the outside
export function getStorageStructures(roomName: string): (StructureContainer | StructureStorage)[] {
  const structures: (StructureContainer | StructureStorage)[] = [];
  const roomSites = sitesByRoom[roomName];
  if (!roomSites) {
    return structures;
  }
  return queryIds(
    `ess-${roomName}-storageStructures`,
    () => {
      for (const area of roomSites) {
        for (const posXY of area.storage) {
          const pos = new RoomPosition(posXY[0], posXY[1], roomName);
          const storageStructures = structureTypesAtPos(pos, new Set([STRUCTURE_STORAGE, STRUCTURE_CONTAINER])) as (
            | StructureContainer
            | StructureStorage
          )[];
          structures.push(...storageStructures);
        }
      }
      return structures;
    },
    100
  );
}

export function isXyInAreaDef(posXY: [number, number], areaDef: EssSiteDefinition): boolean {
  const x = posXY[0];
  const y = posXY[1];
  const bounds = areaDef.bounds;
  return x >= bounds[0][0] && x <= bounds[1][0] && y >= bounds[0][1] && y <= bounds[1][1];
}

export function getNonStorageLinks(roomName: string): StructureLink[] {
  return queryIds(
    `ess-${roomName}-nonStorageLinks`,
    () => {
      const room = Game.rooms[roomName];
      const links = room.find(FIND_MY_STRUCTURES, {
        filter: s => {
          if (s.structureType !== STRUCTURE_LINK) {
            return false;
          }
          let inAnyArea = false;
          for (const area of getSitesByRoom(roomName)) {
            if (isXyInAreaDef([s.pos.x, s.pos.y], area)) {
              inAnyArea = true;
            }
            for (const sinkXY of area.linkSinks || []) {
              if (s.pos.x === sinkXY[0] && s.pos.y === sinkXY[1]) {
                inAnyArea = true;
              }
            }
            if (inAnyArea) {
              break;
            }
          }
          return !inAnyArea;
        }
      });
      return links as StructureLink[];
    },
    100
  );
}

export function getStorageLinks(roomName: string): StructureLink[] {
  return queryIds(
    `ess-${roomName}-storageLinks`,
    () => {
      const room = Game.rooms[roomName];
      const links = room.find(FIND_MY_STRUCTURES, {
        filter: s => {
          if (s.structureType !== STRUCTURE_LINK) {
            return false;
          }
          for (const area of getSitesByRoom(roomName)) {
            if (isXyInAreaDef([s.pos.x, s.pos.y], area)) {
              return true;
            }
          }
          return false;
        }
      });
      return links as StructureLink[];
    },
    100
  );
}

export function getLinkSinks(roomName: string): StructureLink[] {
  return queryIds(
    `ess-${roomName}-linkSinks`,
    () => {
      const room = Game.rooms[roomName];
      const links = room.find(FIND_MY_STRUCTURES, {
        filter: s => {
          if (s.structureType !== STRUCTURE_LINK) {
            return false;
          }
          for (const area of getSitesByRoom(roomName)) {
            for (const sinkXY of area.linkSinks || []) {
              if (s.pos.x === sinkXY[0] && s.pos.y === sinkXY[1]) {
                return true;
              }
            }
          }
          return false;
        }
      });
      return links as StructureLink[];
    },
    100
  );
}

export function getEnergyContainersOutsideAreas(roomName: string): StructureContainer[] {
  return queryIds(
    `ess-${roomName}-energyContainersOutsideAreas`,
    () => {
      const room = Game.rooms[roomName];
      const containers = room.find(FIND_STRUCTURES, {
        filter: s => {
          if (s.structureType !== STRUCTURE_CONTAINER) {
            return false;
          }
          for (const area of getSitesByRoom(roomName)) {
            if (isXyInAreaDef([s.pos.x, s.pos.y], area)) {
              return false;
            }
          }
          return true;
        }
      });
      return containers as StructureContainer[];
    },
    100
  );
}

export function getSiteByName(name: string): EssSiteDefinition {
  return sitesByName[name];
}

export function getSitesByRoom(roomName: string): EssSiteDefinition[] {
  if (!sitesByRoom[roomName]) {
    return [];
  }
  return sitesByRoom[roomName];
}

// Delta:
// positive: need this resource
// negative: have extra of this resource
export function getDesiredResourcesDelta(roomName: string): Partial<Record<ResourceConstant, number>> {
  return query(
    `ess-${roomName}-desiredResources`,
    () => {
      const roomSites = getSitesByRoom(roomName);
      if (!roomSites) {
        return {};
      }
      const desiredResources: Partial<Record<ResourceConstant, number>> = {};
      for (const area of roomSites) {
        for (const [resourceStr, amount] of Object.entries(area.minResources || {})) {
          const resource = resourceStr as ResourceConstant;
          const existingResources = getSiteResource(roomName, resource);
          const delta = amount - existingResources;
          if (delta == 0) {
            continue;
          }
          if (desiredResources[resource] === undefined) {
            desiredResources[resource] = 0;
          }

          desiredResources[resource] = (desiredResources[resource as ResourceConstant] ?? 0) + delta;
        }
      }
      // console.log("desiredResourcesDelta", roomName, JSON.stringify(desiredResources));
      return desiredResources;
    },
    1
  );
}

// Resources wanted by other ESS sites
export function getDesiredResourcesForOtherSites(roomName: string): Partial<Record<ResourceConstant, number>> {
  return query(
    `ess-${roomName}-desiredResourcesForOtherSites`,
    () => {
      const desiredResources: Partial<Record<ResourceConstant, number>> = {};
      for (const otherRoomName of getUsedRooms()) {
        if (otherRoomName === roomName) {
          continue;
        }
        const delta = getDesiredResourcesDelta(otherRoomName);
        for (const [resourceStr, amount] of Object.entries(delta)) {
          if (amount <= 0) {
            continue;
          }
          const resource = resourceStr as ResourceConstant;
          if (desiredResources[resource] === undefined) {
            desiredResources[resource] = 0;
          }
          desiredResources[resource] = (desiredResources[resource] ?? 0) + amount;
        }
      }
      // console.log("desiredResourcesForOtherSites", roomName, JSON.stringify(desiredResources));
      return desiredResources;
    },
    1
  );
}

// Extra resources that a given ESS site can send to another room
export function getExtraResources(roomName: string): Partial<Record<ResourceConstant, number>> {
  return query(
    `ess-${roomName}-extraResources`,
    () => {
      const resourcesDelta = getDesiredResourcesDelta(roomName);
      const desiredResources = getDesiredResourcesForOtherSites(roomName);
      const extraResources: Partial<Record<ResourceConstant, number>> = {};
      for (const [resourceStr, deltaAmount] of Object.entries(resourcesDelta)) {
        const extraAmount = -deltaAmount;
        const resource = resourceStr as ResourceConstant;
        if (extraAmount <= 0) {
          continue;
        }
        const desiredAmount = desiredResources[resource] ?? 0;
        const extra = Math.min(extraAmount, desiredAmount);
        if (extra <= 0) {
          continue;
        }
        extraResources[resource] = extra;
      }
      // console.log("extraResources", roomName, JSON.stringify(extraResources));
      return extraResources;
    },
    1
  );
}

export function getDesiredResourcesInTerminal(roomName: string): Partial<Record<ResourceConstant, number>> {
  return query(
    `ess-${roomName}-desiredResourcesInTerminal`,
    () => {
      const extraResources = getExtraResources(roomName);
      const marketResources = roomName === mainRoom ? getNeededResources() : {};
      return keywiseAdd(extraResources, marketResources);
    },
    1
  );
}

export function getNeededResourcesInTerminal(roomName: string): Partial<Record<ResourceConstant, number>> {
  return query(
    `ess-${roomName}-neededResourcesInTerminal`,
    () => {
      const terminal = Game.rooms[roomName].terminal;
      if (!terminal) {
        return {};
      }
      return keywiseFilter(
        keywiseSubtract(getDesiredResourcesInTerminal(roomName), terminal.store),
        amount => amount > 0
      );
    },
    1
  );
}

export function getExcessResourcesInTerminal(roomName: string): Partial<Record<ResourceConstant, number>> {
  return query(
    `ess-${roomName}-excessResourcesInTerminal`,
    () => {
      const terminal = Game.rooms[roomName].terminal;
      if (!terminal) {
        return {};
      }
      return keywiseFilter(
        keywiseSubtract(terminal.store, getDesiredResourcesInTerminal(roomName)),
        amount => amount > 0
      );
    },
    1
  );
}
