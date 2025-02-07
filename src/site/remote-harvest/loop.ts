import { bodyPart, spawnInRoom } from "manager/spawn";
import { rhHarvesterLoop } from "./role.rh-harvester";
import { rhMuleLoop } from "./role.rh-mule";
import { getAllSiteDefs } from "./site";
import { isRhHarvester } from "./role.rh-harvester.type";
import { isRhMule } from "./role.rh-mule.type";

export function rhSpawnLoop(): void {
  for (const siteDef of getAllSiteDefs()) {
    if (siteDef.active) {
      const existingHarvesters = _.filter(
        Game.creeps,
        c => isRhHarvester(c) && c.memory.rhSite === siteDef.name
      ).length;
      if (existingHarvesters === 0) {
        const harvesterParts = siteDef.fullRoad
          ? [...bodyPart(WORK, 5), ...bodyPart(CARRY, 4), ...bodyPart(MOVE, 3)]
          : [...bodyPart(WORK, 3), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 3)];
        if (
          spawnInRoom("rh-harvester", {
            roomName: siteDef.roomName,
            assignToRoom: true,
            spawnElsewhereIfNeeded: true,
            additionalMemory: {
              rhSite: siteDef.name
            },
            parts: harvesterParts
          })
        ) {
          return;
        }
      }

      const existingMules = _.filter(Game.creeps, c => isRhMule(c) && c.memory.rhSite === siteDef.name).length;
      if (existingMules >= siteDef.numMules) {
        continue;
      }
      const muleParts = siteDef.fullRoad
        ? [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 2)]
        : [...bodyPart(CARRY, 3), ...bodyPart(MOVE, 3)];
      if (
        spawnInRoom("rh-mule", {
          roomName: siteDef.roomName,
          assignToRoom: true,
          spawnElsewhereIfNeeded: true,
          additionalMemory: {
            rhSite: siteDef.name
          },
          parts: muleParts
        })
      ) {
        return;
      }
    }
  }
}

export function rhLoop(): void {
  rhSpawnLoop();

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (isRhMule(creep)) {
      rhMuleLoop(creep);
    } else if (isRhHarvester(creep)) {
      rhHarvesterLoop(creep);
    }
  }
}
