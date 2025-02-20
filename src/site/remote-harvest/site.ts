// harvest things from other rooms

import { bodyPart } from "utils/body-part";
import { creepsByRole, query, queryId, queryIds } from "utils/query";

import { isRhHarvester, RhHarvesterCreep } from "./role.rh-harvester.type";

export interface RhSiteDef {
  name: string;
  roomName: string;
  source: string;
  harvestPos: () => RoomPosition;
  muleTransferPos: () => RoomPosition;
  muleIdlePos: () => RoomPosition;
  energyCachePos?: () => RoomPosition;
  numMules: number;
  muleParts?: BodyPartConstant[];
  sinks: string[];
  active: boolean;
  // if the path between sink and the source is full of roads
  fullRoad: boolean;
}

const siteDefs: RhSiteDef[] = [
  {
    name: "w21s58",
    source: "5bbcabc79099fc012e634450",
    harvestPos: () => new RoomPosition(23, 43, "W21S58"),
    muleTransferPos: () => new RoomPosition(22, 43, "W21S58"),
    muleIdlePos: () => new RoomPosition(23, 36, "W21S58"),
    energyCachePos: () => new RoomPosition(22, 42, "W21S58"),
    roomName: "W21S58",
    // normally 5 normal, but overloaded to 4 super ones (4x capacity)
    numMules: 2,
    muleParts: [...bodyPart(CARRY, 12), ...bodyPart(MOVE, 6)],
    fullRoad: true,
    sinks: [
      // main room right side link
      "67ac472186eef035eca87012",
      // main storage
      "679a16c3135bf04cc4b9f12e",
      // second storage
      "67a143d162f5371cbb7bb49b"
    ],
    active: false
  },
  {
    name: "w21s59-0",
    source: "5bbcabc79099fc012e634452",
    harvestPos: () => new RoomPosition(38, 3, "W21S59"),
    muleTransferPos: () => new RoomPosition(38, 2, "W21S59"),
    muleIdlePos: () => new RoomPosition(25, 47, "W21S58"),
    energyCachePos: () => new RoomPosition(37, 2, "W21S59"),
    roomName: "W21S59",
    numMules: 1,
    fullRoad: true,
    sinks: [
      // w21s58 link
      "67adf09b135bf0a3a2bf4253",
      // W21s58 cache
      "67a936f6d2beb34270391d74",
      // main room right side link
      // "679f323406a28817ac47c452",
      // main storage
      // "679a16c3135bf04cc4b9f12e",
      // second storage
      "67a143d162f5371cbb7bb49b"
    ],
    muleParts: [...bodyPart(CARRY, 10), ...bodyPart(MOVE, 5)],
    active: true
  },
  {
    name: "w21s59-1",
    source: "5bbcabc79099fc012e634453",
    harvestPos: () => new RoomPosition(40, 9, "W21S59"),
    muleTransferPos: () => new RoomPosition(39, 9, "W21S59"),
    muleIdlePos: () => new RoomPosition(34, 6, "W21S59"),
    energyCachePos: () => new RoomPosition(39, 8, "W21S59"),
    roomName: "W21S59",
    numMules: 1,
    fullRoad: true,
    sinks: [
      // w21s58 link
      "67adf09b135bf0a3a2bf4253",
      // W21s58 cache
      "67a936f6d2beb34270391d74",
      // main room right side link
      // "679f323406a28817ac47c452",
      // main storage
      // "679a16c3135bf04cc4b9f12e",
      // second storage
      "67a143d162f5371cbb7bb49b"
    ],
    muleParts: [...bodyPart(CARRY, 12), ...bodyPart(MOVE, 6)],
    active: true
  }
];

const sitesByRoom: { [roomName: string]: RhSiteDef[] } = {};
const sitesByName: { [name: string]: RhSiteDef } = {};
for (const siteDef of siteDefs) {
  const roomName = siteDef.roomName;
  if (sitesByRoom[roomName] === undefined) {
    sitesByRoom[roomName] = [];
  }
  sitesByRoom[roomName].push(siteDef);
  sitesByName[siteDef.name] = siteDef;
}

export function getAllSiteDefs(): RhSiteDef[] {
  return siteDefs;
}

export function getSiteByName(name: string): RhSiteDef | null {
  return sitesByName[name];
}

export function getUsedRooms(): string[] {
  return Object.keys(sitesByRoom);
}

export function getRhHarvester(siteName: string): RhHarvesterCreep | null {
  return query(`rh-${siteName}-harvester`, () => {
    const rhHarvesters = creepsByRole("rh-harvester") as RhHarvesterCreep[];
    for (const rhHarvester of rhHarvesters) {
      if (isRhHarvester(rhHarvester) && rhHarvester.memory.rhSite === siteName) {
        return rhHarvester;
      }
    }
    return null;
  });
}

export function getEnergyCache(siteName: string): StructureContainer | null {
  return queryId(
    `rh-${siteName}-energy-cache`,
    () => {
      const site = getSiteByName(siteName);
      if (site && site.energyCachePos) {
        const container = site.energyCachePos();
        return container.lookFor(LOOK_STRUCTURES)[0] as StructureContainer;
      }
      return null;
    },
    100
  );
}

export function getEnergyCachesByRoom(roomName: string): StructureContainer[] {
  return queryIds(`rh-${roomName}-energy-caches`, () => {
    const siteDefs = sitesByRoom[roomName] ?? [];
    const containers: StructureContainer[] = [];
    for (const siteDef of siteDefs) {
      if (siteDef.energyCachePos) {
        const container = siteDef.energyCachePos();
        for (const structure of container.lookFor(LOOK_STRUCTURES)) {
          if (structure.structureType === STRUCTURE_CONTAINER) {
            containers.push(structure as StructureContainer);
          }
        }
      }
    }
    return containers;
  });
}
