export function creepDps(creep: Creep): number {
  return Math.max(
    creep.getActiveBodyparts(ATTACK) * ATTACK_POWER,
    creep.getActiveBodyparts(RANGED_ATTACK) * RANGED_ATTACK_POWER
  );
}

export function creepHps(creep: Creep): number {
  return creep.getActiveBodyparts(HEAL) * HEAL_POWER;
}
