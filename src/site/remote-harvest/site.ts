// harvest things from other rooms

import { bodyPart } from "utils/body-part";
import { RhHarvesterCreep, isRhHarvester } from "./role.rh-harvester.type";

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
    numMules: 4,
    muleParts: [...bodyPart(CARRY, 16), ...bodyPart(MOVE, 8)],
    fullRoad: true,
    sinks: [
      // main room right side link
      // "679f323406a28817ac47c452",
      // main storage
      "679a16c3135bf04cc4b9f12e",
      // second storage
      "67a143d162f5371cbb7bb49b"
    ],
    active: true
  },
  {
    name: "w21s59-0",
    source: "5bbcabc79099fc012e634452",
    harvestPos: () => new RoomPosition(38, 3, "W21S59"),
    muleTransferPos: () => new RoomPosition(38, 2, "W21S59"),
    muleIdlePos: () => new RoomPosition(25, 47, "W21S58"),
    energyCachePos: () => new RoomPosition(37, 2, "W21S59"),
    roomName: "W21S59",
    numMules: 3,
    fullRoad: false,
    sinks: [
      // W21s58 cache
      "67a936f6d2beb34270391d74",
      // main room right side link
      "679f323406a28817ac47c452",
      // main storage
      // "679a16c3135bf04cc4b9f12e",
      // second storage
      "67a143d162f5371cbb7bb49b"
    ],
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
    numMules: 3,
    fullRoad: false,
    sinks: [
      // W21s58 cache
      "67a936f6d2beb34270391d74",
      // main room right side link
      "679f323406a28817ac47c452",
      // main storage
      // "679a16c3135bf04cc4b9f12e",
      // second storage
      "67a143d162f5371cbb7bb49b"
    ],
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

// TODO cache
export function getRhHarvester(siteName: string): RhHarvesterCreep | null {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (isRhHarvester(creep) && creep.memory.rhSite === siteName) {
      return creep;
    }
  }
  return null;
}
