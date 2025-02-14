// take energy from energySources and put it into storage

import { bodyPart } from "utils/body-part";

export interface EssSiteDefinition {
  name: string;
  roomName: string;
  bounds: number[][];
  storage: number[][];
  sources: number[][];
  linkSinks?: number[][];
  distributors: number;
  distributorParts?: BodyPartConstant[];
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
    distributorParts: [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 2)]
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
    distributorParts: [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 2)]
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
  let count = 0;
  const storageStructures = getStorageStructures(roomName);
  for (const storage of storageStructures) {
    if (storage.structureType === STRUCTURE_STORAGE || storage.structureType === STRUCTURE_CONTAINER) {
      const typedStorage = storage;
      count += typedStorage.store[resourceName];
    }
  }
  return count;
}

// Places to get or dump energy from the outside
export function getStorageStructures(roomName: string): (StructureContainer | StructureStorage)[] {
  const structures: (StructureContainer | StructureStorage)[] = [];
  const roomSites = sitesByRoom[roomName];
  if (!roomSites) {
    return structures;
  }
  for (const area of roomSites) {
    for (const posXY of area.storage) {
      const pos = new RoomPosition(posXY[0], posXY[1], roomName);
      const storageStructures = pos
        .lookFor(LOOK_STRUCTURES)
        .filter(s => s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER) as (
        | StructureContainer
        | StructureStorage
      )[];
      structures.push(...storageStructures);
    }
  }
  return structures;
}

export function isXyInAreaDef(posXY: [number, number], areaDef: EssSiteDefinition): boolean {
  const x = posXY[0];
  const y = posXY[1];
  const bounds = areaDef.bounds;
  return x >= bounds[0][0] && x <= bounds[1][0] && y >= bounds[0][1] && y <= bounds[1][1];
}

export function getNonStorageLinks(roomName: string): StructureLink[] {
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
}

export function getStorageLinks(roomName: string): StructureLink[] {
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
}

export function getLinkSinks(roomName: string): StructureLink[] {
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
}

export function getEnergyContainersOutsideAreas(roomName: string): StructureContainer[] {
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
