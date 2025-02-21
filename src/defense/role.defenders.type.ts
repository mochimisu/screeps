interface DefenderMemory extends CreepMemory {
  defenseAreaIndex: number;
  slotIndex?: number;
}

interface DefenderMeleeMemory extends DefenderMemory {
  role: "defender-melee";
}

interface DefenderRangedMemory extends DefenderMemory {
  role: "defender-ranged";
}

interface DefenderRepairerMemory extends DefenderMemory {
  role: "defender-repairer";
}

interface DefenderMeleeCreep extends Creep {
  memory: DefenderMeleeMemory;
}
interface DefenderRangedCreep extends Creep {
  memory: DefenderRangedMemory;
}
interface DefenderRepairerCreep extends Creep {
  memory: DefenderRepairerMemory;
}

export function isDefenderMelee(creep: Creep): creep is DefenderMeleeCreep {
  return creep.memory.role === "defender-melee";
}

export function isDefenderRanged(creep: Creep): creep is DefenderRangedCreep {
  return creep.memory.role === "defender-ranged";
}

export function isDefenderRepairer(creep: Creep): creep is DefenderRepairerCreep {
  return creep.memory.role === "defender-repairer";
}

export function isDefender(creep: Creep): creep is DefenderMeleeCreep | DefenderRangedCreep | DefenderRepairerCreep {
  return isDefenderMelee(creep) || isDefenderRanged(creep) || isDefenderRepairer(creep);
}
