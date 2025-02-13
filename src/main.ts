import { spawnLoop } from "manager/spawn";
import { muleLoop, muleSpawnLoop } from "role/mule";
import { ErrorMapper } from "utils/ErrorMapper";
import { constructLoop as energyManagerConstructLoop } from "manager/energy";
import { energyStorageLoop } from "site/energy-storage-site/loop";
import { harvesterLoop } from "role/harvester";
import { upgraderLoop } from "role/upgrader";
import { builderLoop, builderSpawnLoop } from "role/builder";
import { attackerLoop } from "role/attacker";
import { claimerLoop } from "role/claimer";
import { janitorLoop } from "role/janitor";
import { harvesterNoMoveLoop, harvesterNoMoveSpawnLoop } from "role/harvester-nomove";
import { repairerLoop } from "role/repairer";
import { towerLoop } from "role/tower";
import { HarvesterCreep, isHarvester } from "role/harvester.type";
import { UpgraderCreep, isUpgrader } from "role/upgrader.type";
import { BuilderCreep, isBuilder } from "role/builder.type";
import { AttackerCreep, isAttacker } from "role/attacker.type";
import { ClaimerCreep, isClaimer } from "role/claimer.type";
import { JanitorCreep, isJanitor } from "role/janitor.type";
import { HarvesterNoMoveCreep, isHarvesterNoMove } from "role/harvester-nomove.type";
import { RepairerCreep, isRepairer } from "role/repairer.type";
import { MuleCreep, isMule } from "role/mule.type";
import * as scriptsImpl from "utils/scripts";
import { rhLoop } from "site/remote-harvest/loop";
import { ReserverCreep, isReserver } from "role/reserver.type";
import { reserverLoop } from "role/reserver";
import { UpgraderNoMoveCreep, isUpgraderNoMove } from "role/upgrader-nomove.type";
import { upgraderNoMoveLoop, upgraderNoMoveSpawnLoop } from "role/upgrader-nomove";
import { orderLoop } from "market/orders";
import { DismantlerCreep, isDismantler } from "role/dismantler.type";
import { dismantlerLoop } from "role/dismantler";
import { creepsByRole, queryLoop } from "utils/query";

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
    born?: number;
    replaceAt?: number;
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
  queryLoop();
  if (!harvesterNoMoveSpawnLoop()) {
    spawnLoop();
    muleSpawnLoop();
    upgraderNoMoveSpawnLoop();
    builderSpawnLoop();
  }

  // energy manager
  energyManagerConstructLoop();

  // sites
  energyStorageLoop();
  rhLoop();

  // Iterate over all creeps in the game
  for (const harvester of creepsByRole("harvester")) {
    harvesterLoop(harvester as HarvesterCreep);
  }
  for (const upgrader of creepsByRole("upgrader")) {
    upgraderLoop(upgrader as UpgraderCreep);
  }

  for (const builder of creepsByRole("builder")) {
    builderLoop(builder as BuilderCreep);
  }

  for (const attacker of creepsByRole("attacker")) {
    attackerLoop(attacker as AttackerCreep);
  }

  for (const claimer of creepsByRole("claimer")) {
    claimerLoop(claimer as ClaimerCreep);
  }

  for (const janitor of creepsByRole("janitor")) {
    janitorLoop(janitor as JanitorCreep);
  }

  for (const harvesterNoMove of creepsByRole("harvesterNoMove")) {
    harvesterNoMoveLoop(harvesterNoMove as HarvesterNoMoveCreep);
  }

  for (const repairer of creepsByRole("repairer")) {
    repairerLoop(repairer as RepairerCreep);
  }

  for (const mule of creepsByRole("mule")) {
    muleLoop(mule as MuleCreep);
  }

  for (const reserver of creepsByRole("reserver")) {
    reserverLoop(reserver as ReserverCreep);
  }

  for (const upgraderNoMove of creepsByRole("upgraderNoMove")) {
    upgraderNoMoveLoop(upgraderNoMove as UpgraderNoMoveCreep);
  }

  for (const dismantler of creepsByRole("dismantler")) {
    dismantlerLoop(dismantler as DismantlerCreep);
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

  // if bucket is maxed out, generate a pixel
  if (Game.cpu.bucket === 10000) {
    console.log("Bucket is full, generating pixel");
    Game.cpu.generatePixel();
  }
};

global.scripts = scriptsImpl;

module.exports = {
  loop: ErrorMapper.wrapLoop(loop)
};
