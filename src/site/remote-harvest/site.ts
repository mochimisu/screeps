// harvest things from other rooms

import { RhHarvesterCreep, isRhHarvester } from "./role.rh-harvester.type";

export interface RhSiteDef {
  name: string;
  roomName: string;
  source: string;
  harvestPos: () => RoomPosition;
  muleTransferPos: () => RoomPosition;
  muleIdlePos: () => RoomPosition;
  numMules: number;
  sink: string;
  active: boolean;
  // if the path between sink and the source is full of roads
  fullRoad: boolean;
}

const siteDefs: RhSiteDef[] = [
  {
    name: "w21s58",
    source: "5bbcabc79099fc012e634450",
    harvestPos: () => new RoomPosition(23, 43, "W21S58"),
    muleTransferPos: () => new RoomPosition(22, 42, "W21S58"),
    muleIdlePos: () => new RoomPosition(23, 36, "W21S58"),
    roomName: "W21S58",
    numMules: 4,
    fullRoad: true,
    // main room right side link
    sink: "679f323406a28817ac47c452",
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
