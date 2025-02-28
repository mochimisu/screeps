import { getStorageStructures, getUsedRooms } from "site/energy-storage-site/site";
import { queryIds, structureAtPos } from "utils/query";

import { goToMainRoom, mainRoom } from "./room";
import { getEnergyCachesByRoom } from "site/remote-harvest/site";
import { getRange } from "screeps-clockwork";

// temp deny area to build an energy base
const denyArea: { [roomName: string]: number[][][] } = {
  W22S58: [
    [
      [0, 0],
      [49, 20]
    ]
  ]
};

const energyBuffers: { [roomName: string]: number[][] } = {
  W22S58: [
    // [33, 44],
    // [33, 45],
    // [41, 26],
    [9, 16]
  ],
  W22S59: [[6, 27]],
  W21S58: [[29, 19]]
};

export function getEnergyBuffers(roomName: string): (StructureContainer | StructureStorage)[] {
  const buffers: (StructureContainer | StructureStorage)[] = [];
  return queryIds(
    `energy-energyBuffers-${roomName}`,
    () => {
      for (const posXY of energyBuffers[roomName] ?? []) {
        const pos = new RoomPosition(posXY[0], posXY[1], roomName);
        const containers = structureAtPos(pos, STRUCTURE_CONTAINER) as StructureContainer[];
        buffers.push(...containers);
      }
      buffers.push(...getStorageStructures(roomName));
      buffers.push(...getEnergyCachesByRoom(roomName));
      return buffers;
    },
    100
  );
}

export function getAllEnergyBuffers(): (StructureContainer | StructureStorage)[] {
  return queryIds(
    `energy-energyBuffers-all`,
    () => {
      let buffers: (StructureContainer | StructureStorage)[] = [];
      for (const roomName in energyBuffers) {
        buffers = [...buffers, ...getEnergyBuffers(roomName)];
      }
      for (const roomName in getUsedRooms()) {
        buffers.push(...getStorageStructures(roomName));
      }
      return buffers;
    },
    100
  );
}

export function getClosestBufferWithEnergy(creep: Creep, minEnergy = 150): Structure | null {
  const buffers = getAllEnergyBuffers();
  const buffersWithEnergy = buffers.filter(s => s.store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy);

  // Sort sources by distance from the creep
  const sortedSources = _.sortBy(buffersWithEnergy, source => getRange(creep.pos, source.pos));

  // Iterate through the sorted sources
  for (const source of sortedSources) {
    return source;
  }

  return null;
}

export function getEnergy(creep: Creep, minEnergy = 150): boolean {
  const buffer = getClosestBufferWithEnergy(creep, minEnergy);
  if (buffer) {
    if (creep.withdraw(buffer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(buffer, { visualizePathStyle: { stroke: "#ffaa00" }, reusePath: 10 });
    }
    return true;
  }
  if (creep.room.name !== mainRoom) {
    goToMainRoom(creep);
    return true;
  }
  return false;
}

export function getClosestEnergyStorageInNeed(creep: Creep, preferDist = 10): Structure | null {
  const buffers = getEnergyBuffers(creep.room.name);
  const buffersWithoutEnergy = buffers.filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 150);
  const energyStructures = creep.room
    .find(FIND_STRUCTURES)
    .filter(
      structure =>
        // structure.structureType == STRUCTURE_EXTENSION ||
        structure.structureType === STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    )
    .filter(s => {
      if (denyArea[creep.room.name] != null) {
        for (const deny of denyArea[creep.room.name]) {
          if (s.pos.x >= deny[0][0] && s.pos.x <= deny[1][0] && s.pos.y >= deny[0][1] && s.pos.y <= deny[1][1]) {
            return false;
          }
        }
      }
      return true;
    });

  const sortedBuffers = _.sortBy(buffersWithoutEnergy, source => creep.pos.getRangeTo(source));
  const sortedEnergyStructures = _.sortBy(energyStructures, source => creep.pos.getRangeTo(source));
  const sortedLinks = _.sortBy(
    creep.room.find(FIND_MY_STRUCTURES, {
      filter: s => {
        if (s.structureType !== STRUCTURE_LINK) {
          return false;
        }
        if (denyArea[creep.room.name] != null) {
          for (const deny of denyArea[creep.room.name]) {
            if (s.pos.x >= deny[0][0] && s.pos.x <= deny[1][0] && s.pos.y >= deny[0][1] && s.pos.y <= deny[1][1]) {
              return false;
            }
          }
        }
        return s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }),
    source => creep.pos.getRangeTo(source)
  );

  // structures before buffers
  let combined = [...sortedEnergyStructures, ...sortedLinks, ...sortedBuffers];
  const preferDistSources = combined.filter(s => creep.pos.getRangeTo(s) < preferDist);
  combined = [...preferDistSources, ...combined];

  // Iterate through the sorted sources
  for (const source of combined) {
    return source;
  }
  return null;
}

export function constructLoop(): void {
  // For every energyBufferPos, create construction if there isn't something here
  for (const roomName in energyBuffers) {
    for (const posXY of energyBuffers[roomName]) {
      const x = posXY[0];
      const y = posXY[1];
      const pos = new RoomPosition(x, y, roomName);
      const existingObjects = pos.look();
      if (existingObjects.filter(o => o.type === "structure" || o.type === "constructionSite").length > 0) {
        continue;
      }
      pos.createConstructionSite(STRUCTURE_CONTAINER);
    }
  }
}

export function getBufferConstructionSites(): ConstructionSite[] {
  const sites: ConstructionSite[] = [];
  for (const roomName in energyBuffers) {
    const room = Game.rooms[roomName];
    const roomPoss: RoomPosition[] = [];
    for (const posXY of energyBuffers[roomName]) {
      const x = posXY[0];
      const y = posXY[1];
      const pos = new RoomPosition(x, y, roomName);
      const existingObjects = pos.look();
      if (existingObjects.length === 0) {
        continue;
      }
      roomPoss.push(pos);
    }
    if (roomPoss.length > 0) {
      room.find(FIND_MY_CONSTRUCTION_SITES).forEach(site => {
        if (site.pos) {
          for (const pos of roomPoss) {
            if (site.pos.isEqualTo(pos)) {
              sites.push(site);
            }
          }
        }
      });
    }
  }
  return sites;
}
