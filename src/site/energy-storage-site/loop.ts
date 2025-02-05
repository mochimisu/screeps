import { distributorLoop } from "./role.ess-distributor";
import { isEssDistributor } from "./role.ess-distributor.type";
import {
  getAllSiteDefs,
  getNonStorageLinks,
  getSiteByName,
  getSitesByRoom,
  getStorageLinks,
  getUsedRooms
} from "./site";
import { spawnInRoom } from "manager/spawn";

export function energyStorageSpawnLoop(): void {
  const siteDefs = getAllSiteDefs();
  const desiredDistributors: { [siteName: string]: number } = {};
  for (const siteDef of siteDefs) {
    if (siteDef.distributors > 0) {
      desiredDistributors[siteDef.name] = siteDef.distributors;
    }
  }

  const existingDistributors: { [siteName: string]: number } = {};
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (isEssDistributor(creep)) {
      const distributorSiteName = creep.memory.essSiteName;
      if (!distributorSiteName) {
        console.log(`Distributor ${name} has no site name`);
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
          parts: [CARRY, CARRY, MOVE]
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
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (isEssDistributor(creep)) {
      distributorLoop(creep);
    }
  }

  for (const roomName of getUsedRooms()) {
    if (show) {
      const visual = new RoomVisual(roomName);
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
        visual.text(`${roomDef.name} (ess)`, roomDef.bounds[0][0], roomDef.bounds[0][1]);
      }
    }

    // Transfer energy from non-storage links to storage links
    const nonStorageLinks = getNonStorageLinks(roomName).filter(
      link => link.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    );
    const storageLinks = getStorageLinks(roomName).filter(link => link.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    const target = storageLinks[0];
    if (!target) {
      continue;
    }
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
}

module.exports = {
  run: energyStorageLoop
};
