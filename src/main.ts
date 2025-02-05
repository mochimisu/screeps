import { spawnLoop } from "manager/spawn";
import { muleLoop, muleSpawnLoop } from "role/mule";
import { ErrorMapper } from "utils/ErrorMapper";
import { constructLoop as energyManagerConstructLoop } from "manager/energy";
import { energyStorageLoop } from "site/energy-storage-site/loop";
import { harvesterLoop } from "role/harvester";
import { upgraderLoop } from "role/upgrader";
import { builderLoop } from "role/builder";
import { attackerLoop } from "role/attacker";
import { claimerLoop } from "role/claimer";
import { janitorLoop } from "role/janitor";
import { harvesterNoMoveLoop, harvesterNoMoveSpawnLoop } from "role/harvester-nomove";
import { repairerLoop } from "role/repairer";
import { towerLoop } from "role/tower";

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definiton alone.
          You must also give them an implemention if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
    harvesterManager: {
      sources: {
        [sourceId: string]: string[];
      };
    };
    builderManager: {
      sources: {
        [sourceId: string]: string[];
      };
    };
  }

  // TODO can i make these types instead of interfaces?
  interface CreepMemory {
    role: string;
    roomName?: string;

    path?: string;
    status?: string;
    essSiteName?: string;
    sourceId?: string;
    harvesterNoMoveSourcePos?: RoomPosition;
    targetId?: string | null;
    builderManager?: {
      lastSource?: string | null;
    };
    harvesterManager?: {
      lastSource?: string | null;
    };
  }

  interface HarvesterMemory extends CreepMemory {
    role: "harvester";
    status: "harvesting" | "dumping" | "idle-build" | "idle-upgrade";
    // For harvesters
    harvesterManager?: {
      lastSource?: string | null;
    };
    sourceId?: string;
  }

  interface HarvesterNoMoveMemory extends CreepMemory {
    role: "harvester-nomove";
    // for no-move harvesters
    harvesterNoMoveSourcePos?: RoomPosition;
  }

  interface BuilderMemory extends CreepMemory {
    role: "builder";

    // builders
    builderManager?: {
      lastSource?: string | null;
    };
  }

  interface EssDistributorMemory extends CreepMemory {
    role: "ess-distributor";
    essSiteName?: string;
  }

  interface MuleMemory extends CreepMemory {
    role: "mule";
    path?: string;
  }

  interface RepairerMemory extends CreepMemory {
    role: "repairer";
    targetId?: string | null;
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
const loop = () => {
  if (!harvesterNoMoveSpawnLoop()) {
    spawnLoop();
    muleSpawnLoop();
  }

  // energy manager
  energyManagerConstructLoop();

  // sites
  energyStorageLoop();

  // Iterate over all creeps in the game
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    switch (creep.memory.role) {
      case "harvester":
        harvesterLoop(creep);
        break;
      case "upgrader":
        upgraderLoop(creep);
        break;
      case "builder":
        builderLoop(creep);
        break;
      case "attacker":
        attackerLoop(creep);
        break;
      case "claimer":
        claimerLoop(creep);
        break;
      case "janitor":
        janitorLoop(creep);
        break;
      case "harvester-nomove":
        harvesterNoMoveLoop(creep);
        break;
      case "repairer":
        repairerLoop(creep);
        break;
      case "mule":
        muleLoop(creep);
        break;
    }
  }

  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });
    for (const tower of towers) {
      towerLoop(tower as StructureTower);
    }
  }
};

module.exports = {
  loop: ErrorMapper.wrapLoop(loop)
  // loop
};
