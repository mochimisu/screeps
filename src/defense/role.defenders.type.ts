export interface DefenderMemory extends CreepMemory {
  defenseAreaIndex: number;
  slotIndex?: number;
  arrived?: boolean;
}

export interface DefenderMeleeMemory extends DefenderMemory {
  role: "defender-melee";
}

export interface DefenderRangedMemory extends DefenderMemory {
  role: "defender-ranged";
}

export interface DefenderRepairerMemory extends DefenderMemory {
  role: "defender-repairer";
}

export interface DefenderMeleeCreep extends Creep {
  memory: DefenderMeleeMemory;
}
export interface DefenderRangedCreep extends Creep {
  memory: DefenderRangedMemory;
}
export interface DefenderRepairerCreep extends Creep {
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
