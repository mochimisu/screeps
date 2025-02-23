import { defenderSafeAreaMatrix, getMemoryDefense } from "./defense";
import { defenderRoamingLoop } from "./role.defender-roaming";
import { DefenderMeleeCreep } from "./role.defenders.type";

function rampartDefenderMeleeLoop(creep: DefenderMeleeCreep) {
  // Go to the rampart
  const defenseMemory = getMemoryDefense();
  const strategy = creep.memory.roomName ? defenseMemory.strategy[creep.memory.roomName] : null;
  if (strategy?.type !== "base-rampart") {
    return;
  }
  const defenseAreaIndex = creep.memory.defenseAreaIndex;
  const defenseArea = strategy.defenseAreas[defenseAreaIndex];
  const rampartPos = defenseArea.rampartMelee;
  if (!creep.memory.arrived) {
    for (const posSerialized of rampartPos) {
      const pos = new RoomPosition(posSerialized.x, posSerialized.y, posSerialized.roomName);
      // Go to the rampart of the defense area we are assigned to
      if (creep.pos.isEqualTo(pos)) {
        creep.memory.arrived = true;
      }
    }
    if (!creep.memory.arrived) {
      creep.moveTo(new RoomPosition(rampartPos[0].x, rampartPos[0].y, rampartPos[0].roomName));
      return;
    }
  } else {
    // Navigate using the inverse of the defense area matrix to prevent leaving safe spots
    const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
    if (!target) {
      return;
    }
    if (creep.attack(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, {
        costCallback: defenderSafeAreaMatrix
      });
    }
  }
}

export function defenderMeleeLoop(creep: DefenderMeleeCreep) {
  const defenseMemory = getMemoryDefense();
  const strategy = creep.memory.roomName ? defenseMemory.strategy[creep.memory.roomName] : null;
  if (strategy?.type === "base-rampart") {
    return rampartDefenderMeleeLoop(creep);
  }
  return defenderRoamingLoop(creep);
}
