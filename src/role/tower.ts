export function towerLoop(tower: StructureTower): void {
  // Find the closest hostile creep
  const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
  if (closestHostile) {
    // If a hostile creep is found, attack it
    tower.attack(closestHostile);
  } else {
    // If no hostile creeps are present, proceed to repair or heal

    // Find the closest damaged structure (excluding walls)
    const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure =>
        (structure.hits / structure.hitsMax < 0.4 &&
          structure.structureType !== STRUCTURE_WALL &&
          structure.structureType !== STRUCTURE_RAMPART) ||
        (structure.structureType === STRUCTURE_RAMPART && structure.hits < 1000)
    });

    if (closestDamagedStructure) {
      // If a damaged structure is found, repair it
      tower.repair(closestDamagedStructure);
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
