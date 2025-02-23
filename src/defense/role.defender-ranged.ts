import { defenderSafeAreaMatrix, getMemoryDefense } from "./defense";
import { defenderRoamingLoop } from "./role.defender-roaming";
import { DefenderRangedCreep } from "./role.defenders.type";

function rampartDefenderRangedLoop(creep: DefenderRangedCreep) {
  // Go to the rampart
  const defenseMemory = getMemoryDefense();
  const strategy = creep.memory.roomName ? defenseMemory.strategy[creep.memory.roomName] : null;
  if (strategy?.type !== "base-rampart") {
    return;
  }
  const defenseAreaIndex = creep.memory.defenseAreaIndex;
  const defenseArea = strategy.defenseAreas[defenseAreaIndex];
  const rampartPos = defenseArea.rampartRanged;
  if (!creep.memory.arrived) {
    for (const posSerialized of rampartPos) {
      const pos = new RoomPosition(posSerialized.x, posSerialized.y, posSerialized.roomName);
      // Go to the rampart of the defense area we are assigned to
      if (creep.pos.isEqualTo(pos)) {
        creep.memory.arrived = true;
      }
    }
    if (!creep.memory.arrived) {
      const idx = Math.floor(Math.random() * rampartPos.length);
      creep.moveTo(new RoomPosition(rampartPos[idx].x, rampartPos[idx].y, rampartPos[idx].roomName));
      if (Game.time - (creep.memory.born ?? 0) < 100) {
        return;
      }
    }
  }
  // Navigate using the inverse of the defense area matrix to prevent leaving safe spots
  const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
  if (!target) {
    return;
  }
  if (creep.rangedAttack(target) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, {
      costCallback: defenderSafeAreaMatrix
    });
  }
}

export function defenderRangedLoop(creep: DefenderRangedCreep) {
  const defenseMemory = getMemoryDefense();
  const strategy = creep.memory.roomName ? defenseMemory.strategy[creep.memory.roomName] : null;
  if (strategy?.type === "base-rampart") {
    return rampartDefenderRangedLoop(creep);
  }
  return defenderRoamingLoop(creep);
}
