import { constructLoop as energyManagerConstructLoop } from "manager/energy";
import { managerRepairLoop } from "manager/repair";
import { spawnLoop } from "manager/spawn";
import { orderLoop } from "market/orders";
import { attackerLoop } from "role/attacker";
import { AttackerCreep } from "role/attacker.type";
import { builderLoop, builderSpawnLoop } from "role/builder";
import { BuilderCreep } from "role/builder.type";
import { claimerLoop } from "role/claimer";
import { ClaimerCreep } from "role/claimer.type";
import { dismantlerLoop } from "role/dismantler";
import { DismantlerCreep } from "role/dismantler.type";
import { harvesterLoop } from "role/harvester";
import { HarvesterCreep } from "role/harvester.type";
import { harvesterNoMoveLoop, harvesterNoMoveSpawnLoop } from "role/harvester-nomove";
import { HarvesterNoMoveCreep } from "role/harvester-nomove.type";
import { janitorLoop } from "role/janitor";
import { JanitorCreep } from "role/janitor.type";
import { muleLoop, muleSpawnLoop } from "role/mule";
import { MuleCreep } from "role/mule.type";
import { repairerLoop, repairerSpawnLoop } from "role/repairer";
import { RepairerCreep } from "role/repairer.type";
import { reserverLoop } from "role/reserver";
import { ReserverCreep } from "role/reserver.type";
import { towerLoop } from "role/tower";
import { upgraderLoop } from "role/upgrader";
import { UpgraderCreep } from "role/upgrader.type";
import { upgraderNoMoveLoop, upgraderNoMoveSpawnLoop } from "role/upgrader-nomove";
import { UpgraderNoMoveCreep } from "role/upgrader-nomove.type";
import { initialize } from "screeps-clockwork";
import profiler from "screeps-profiler";
import { energyStorageLoop } from "site/energy-storage-site/loop";
import { rhLoop } from "site/remote-harvest/loop";
import { ErrorMapper } from "utils/ErrorMapper";
import { creepsByRole, queryLoop } from "utils/query";
import * as scriptsImpl from "utils/scripts";
import { terminalLoop } from "manager/terminal";
import "defense/scripts";
import "attack/scripts";
import { defenseLoop } from "defense/loop";
import { scoutSingleLoop } from "role/scout-single";
import { ScoutSingleCreep } from "role/scout-single.type";
import { attackLoop } from "attack/loop";
import { ControllerAttackerCreep } from "role/controller-attacker.type";
import { controllerAttackerLoop, controllerAttackerSpawnLoop } from "role/controller-attacker";
import { dumperLoop } from "role/dumper";
import { DumperCreep } from "role/dumper.type";

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
  profiler.wrap(() => {
    // clockwork (pathing)
    initialize(true);

    queryLoop();
    if (!harvesterNoMoveSpawnLoop()) {
      spawnLoop();
      muleSpawnLoop();
      upgraderNoMoveSpawnLoop();
      builderSpawnLoop();
      repairerSpawnLoop();
      controllerAttackerSpawnLoop();
    }

    // managers
    energyManagerConstructLoop();
    managerRepairLoop();

    // sites
    energyStorageLoop();
    rhLoop();

    // combat
    defenseLoop();
    attackLoop();

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

    for (const harvesterNoMove of creepsByRole("harvester-nomove")) {
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

    for (const upgraderNoMove of creepsByRole("upgrader-nomove")) {
      upgraderNoMoveLoop(upgraderNoMove as UpgraderNoMoveCreep);
    }

    for (const dismantler of creepsByRole("dismantler")) {
      dismantlerLoop(dismantler as DismantlerCreep);
    }

    for (const scout of creepsByRole("scout-single")) {
      scoutSingleLoop(scout as ScoutSingleCreep);
    }

    for (const controllerAttacker of creepsByRole("controller-attacker")) {
      controllerAttackerLoop(controllerAttacker as ControllerAttackerCreep);
    }
    for (const dumper of creepsByRole("dumper")) {
      dumperLoop(dumper as DumperCreep);
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

    // terminal balance
    terminalLoop();

    // if bucket is maxed out, generate a pixel
    // if (Game.cpu.bucket === 10000) {
    //   console.log("Bucket is full, generating pixel");
    //   Game.cpu.generatePixel();
    // }
  });
};

global.scripts = scriptsImpl;
profiler.enable();

module.exports = {
  loop: ErrorMapper.wrapLoop(loop)
};
