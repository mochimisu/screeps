import { spawnInRoom } from "manager/spawn";
import { bodyPart } from "utils/body-part";
import { creepsByRole } from "utils/query";

import { rhHarvesterLoop } from "./role.rh-harvester";
import { isRhHarvester, RhHarvesterCreep } from "./role.rh-harvester.type";
import { rhMuleLoop } from "./role.rh-mule";
import { isRhMule, RhMuleCreep } from "./role.rh-mule.type";
import { getAllSiteDefs } from "./site";

export function rhSpawnLoop(): void {
  for (const siteDef of getAllSiteDefs()) {
    if (siteDef.active) {
      const existingHarvesters = creepsByRole("rh-harvester").filter(
        c =>
          isRhHarvester(c) &&
          c.memory.rhSite === siteDef.name &&
          (c.memory.replaceAt == null || c.memory.replaceAt > Game.time)
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

      const existingMules = creepsByRole("rh-mule").filter(c => isRhMule(c) && c.memory.rhSite === siteDef.name).length;
      if (existingMules >= siteDef.numMules) {
        continue;
      }
      const muleParts =
        siteDef.muleParts ??
        (siteDef.fullRoad
          ? [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 2)]
          : [...bodyPart(CARRY, 3), ...bodyPart(MOVE, 3)]);
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

export function rhBuildLoop(): void {
  for (const siteDef of getAllSiteDefs()) {
    if (!siteDef.active) {
      continue;
    }
    // Build a container at energyCachePos if it doesn't exist
    if (siteDef.energyCachePos) {
      const pos = siteDef.energyCachePos();
      const structures = pos
        .lookFor(LOOK_STRUCTURES)
        .filter(s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE);
      if (structures.length === 0) {
        if (pos.lookFor(LOOK_CONSTRUCTION_SITES).length === 0) {
          const room = Game.rooms[siteDef.roomName];
          if (room) {
            room.createConstructionSite(pos, STRUCTURE_CONTAINER);
          }
        }
      }
    }
  }
}

export function rhLoop(): void {
  rhSpawnLoop();
  rhBuildLoop();

  for (const rhMule of creepsByRole("rh-mule")) {
    rhMuleLoop(rhMule as RhMuleCreep);
  }
  for (const rhHarvester of creepsByRole("rh-harvester")) {
    rhHarvesterLoop(rhHarvester as RhHarvesterCreep);
  }
}
