import { getTowerRepairTargetIds, shouldTowerRepairStructure } from "manager/repair";

function getTowerRepairTarget(tower: StructureTower): Structure | null {
  const repairTargets = getTowerRepairTargetIds(tower.room.name);
  for (const id of repairTargets) {
    const structure = Game.getObjectById(id);
    if (structure && shouldTowerRepairStructure(structure)) {
      return structure;
    }
  }
  return null;
}

export function towerLoop(tower: StructureTower): void {
  // Find the closest hostile creep
  let closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
  // proritize healers first
  const hostileHealers = tower.room.find(FIND_HOSTILE_CREEPS, {
    filter: c => c.getActiveBodyparts(HEAL) > 0
  });
  if (hostileHealers.length > 0) {
    closestHostile = tower.pos.findClosestByRange(hostileHealers);
  }
  if (closestHostile) {
    // If a hostile creep is found, attack it
    tower.attack(closestHostile);
  } else {
    // If no hostile creeps are present, proceed to repair or heal

    // Find the closest damaged structure (excluding walls)
    const towerRepairTarget = getTowerRepairTarget(tower);

    if (towerRepairTarget) {
      // If a damaged structure is found, repair it
      tower.repair(towerRepairTarget);
    } else {
      // If no structures need repairing, find the closest wounded friendly creep
      const closestWoundedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: creep => creep.hits < creep.hitsMax
      });

      if (closestWoundedCreep) {
        // If a wounded creep is found, heal it
        tower.heal(closestWoundedCreep);
      }
    }
  }
}
