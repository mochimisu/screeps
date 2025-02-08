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
import { isHarvester } from "role/harvester.type";
import { isUpgrader } from "role/upgrader.type";
import { isBuilder } from "role/builder.type";
import { isAttacker } from "role/attacker.type";
import { isClaimer } from "role/claimer.type";
import { isJanitor } from "role/janitor.type";
import { isHarvesterNoMove } from "role/harvester-nomove.type";
import { isRepairer } from "role/repairer.type";
import { isMule } from "role/mule.type";
import * as scriptsImpl from "utils/scripts";
import { rhLoop } from "site/remote-harvest/loop";
import { isReserver } from "role/reserver.type";
import { reserverLoop } from "role/reserver";
import { isUpgraderNoMove } from "role/upgrader-nomove.type";
import { upgraderNoMoveLoop, upgraderNoMoveSpawnLoop } from "role/upgrader-nomove";
import { orderLoop } from "market/orders";

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

  interface CreepMemory {
    role: string;
    roomName?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace NodeJS {
    export interface Global {
      scripts: typeof scriptsImpl;
    }
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
const loop = () => {
  if (!harvesterNoMoveSpawnLoop()) {
    spawnLoop();
    muleSpawnLoop();
    upgraderNoMoveSpawnLoop();
  }

  // energy manager
  energyManagerConstructLoop();

  // sites
  energyStorageLoop();
  rhLoop();

  // Iterate over all creeps in the game
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (isHarvester(creep)) {
      harvesterLoop(creep);
    } else if (isUpgrader(creep)) {
      upgraderLoop(creep);
    } else if (isBuilder(creep)) {
      builderLoop(creep);
    } else if (isAttacker(creep)) {
      attackerLoop(creep);
    } else if (isClaimer(creep)) {
      claimerLoop(creep);
    } else if (isJanitor(creep)) {
      janitorLoop(creep);
    } else if (isHarvesterNoMove(creep)) {
      harvesterNoMoveLoop(creep);
    } else if (isRepairer(creep)) {
      repairerLoop(creep);
    } else if (isMule(creep)) {
      muleLoop(creep);
    } else if (isReserver(creep)) {
      reserverLoop(creep);
    } else if (isUpgraderNoMove(creep)) {
      upgraderNoMoveLoop(creep);
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

  // market
  orderLoop();
};

global.scripts = scriptsImpl;

module.exports = {
  loop: ErrorMapper.wrapLoop(loop)
};
