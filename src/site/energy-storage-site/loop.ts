import { spawnInRoom } from "manager/spawn";
import { bodyPart } from "utils/body-part";
import { creepsByRole, creepsByRoomAssignmentAndRole } from "utils/query";

import { distributorLoop } from "./role.ess-distributor";
import { EssDistributorCreep, isEssDistributor } from "./role.ess-distributor.type";
import {
  getAllSiteDefs,
  getCachedSiteResource,
  getLinkSinks,
  getNonStorageLinks,
  getSiteByName,
  getSitesByRoom,
  getStorageLinks,
  getUsedRooms
} from "./site";
import { essTransactorLoop } from "./role.ess-transactor";
import { EssTransactorCreep } from "./role.ess-transactor.type";

// TODO Move into room key

export function energyStorageSpawnLoop(): void {
  const siteDefs = getAllSiteDefs();
  const desiredDistributors: { [siteName: string]: number } = {};
  const desiredTransactors: { [siteName: string]: number } = {};
  for (const siteDef of siteDefs) {
    if (siteDef.distributors > 0) {
      desiredDistributors[siteDef.name] = siteDef.distributors;
    }
    if (siteDef.transactor != null) {
      desiredTransactors[siteDef.name] = siteDef.transactor.length;
    }
  }

  const existingDistributors: { [siteName: string]: number } = {};
  for (const creep of creepsByRole("ess-distributor")) {
    if (isEssDistributor(creep) && !creep.memory.wartime) {
      const distributorSiteName = creep.memory.essSiteName;
      if (!distributorSiteName) {
        console.log(`Distributor ${creep.name} has no site name`);
        continue;
      }
      if (existingDistributors[distributorSiteName] === undefined) {
        existingDistributors[distributorSiteName] = 0;
      }
      existingDistributors[distributorSiteName]++;
    }
  }

  for (const siteName in desiredDistributors) {
    const siteDef = getSiteByName(siteName);
    const desired = desiredDistributors[siteName];
    const existing = existingDistributors[siteName] || 0;
    if (existing < desired) {
      if (
        spawnInRoom("ess-distributor", {
          roomName: siteDef.roomName,
          assignToRoom: true,
          spawnElsewhereIfNeeded: true,
          additionalMemory: {
            essSiteName: siteName
          },
          parts: siteDef.distributorParts ?? [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 2)]
        })
      ) {
        return;
      }
    }
  }

  for (const siteName in desiredTransactors) {
    const siteDef = getSiteByName(siteName);
    const existingTransactors = creepsByRoomAssignmentAndRole(siteDef.roomName, "ess-transactor").length;
    if (existingTransactors < desiredTransactors[siteName]) {
      if (
        spawnInRoom("ess-transactor", {
          roomName: siteDef.roomName,
          assignToRoom: true,
          spawnElsewhereIfNeeded: true,
          additionalMemory: {
            essSiteName: siteName
          },
          parts: [...bodyPart(CARRY, 5), ...bodyPart(MOVE, 1)]
        })
      ) {
        return;
      }
    }
  }
}

const show = true;

export function energyStorageLoop(): void {
  energyStorageSpawnLoop();
  for (const distributor of creepsByRole("ess-distributor")) {
    distributorLoop(distributor as EssDistributorCreep);
  }
  for (const transactor of creepsByRole("ess-transactor")) {
    essTransactorLoop(transactor as EssTransactorCreep);
  }

  for (const roomName of getUsedRooms()) {
    if (show) {
      const visual = new RoomVisual(roomName);
      const energy = getCachedSiteResource(roomName, RESOURCE_ENERGY);
      for (const roomDef of getSitesByRoom(roomName)) {
        visual.rect(
          roomDef.bounds[0][0],
          roomDef.bounds[0][1],
          roomDef.bounds[1][0] - roomDef.bounds[0][0],
          roomDef.bounds[1][1] - roomDef.bounds[0][1],
          {
            fill: "transparent",
            stroke: "#228B22",
            lineStyle: "dashed"
          }
        );
        visual.text(
          `${energy}`,
          (roomDef.bounds[0][0] + roomDef.bounds[1][0]) / 2,
          (roomDef.bounds[0][1] + roomDef.bounds[1][1]) / 2
        );
      }
    }

    // Transfer energy from non-storage links to storage links
    const nonStorageLinks = getNonStorageLinks(roomName).filter(
      link => link.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    );
    const storageLinks = getStorageLinks(roomName);
    const target = storageLinks.filter(link => link.store.getFreeCapacity(RESOURCE_ENERGY) > 0)[0];
    if (target) {
      for (const nonStorageLink of nonStorageLinks) {
        const transferAmount = Math.min(
          nonStorageLink.store.getUsedCapacity(RESOURCE_ENERGY),
          target.store.getFreeCapacity(RESOURCE_ENERGY)
        );
        nonStorageLink.transferEnergy(target, transferAmount);
        if (target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          // TODO can do all of this in 1 tick
          break;
        }
      }
    }

    // Transfer energy from storage links to sink links
    const linkSinks = getLinkSinks(roomName).filter(link => link.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    for (const linkSink of linkSinks) {
      for (const storageLink of storageLinks) {
        const transferAmount = Math.min(
          storageLink.store.getUsedCapacity(RESOURCE_ENERGY),
          linkSink.store.getFreeCapacity(RESOURCE_ENERGY)
        );
        storageLink.transferEnergy(linkSink, transferAmount);
        if (linkSink.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
          // TODO can do all of this in 1 tick
          break;
        }
      }
    }
  }
}

module.exports = {
  run: energyStorageLoop
};
