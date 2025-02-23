export interface AttackTowerDrainAttackerCreep extends Creep {
  role: "atd-attacker";
}

export interface AttackTowerDrainHealerCreep extends Creep {
  role: "atd-healer";
}

export interface AttackTowerDrainDismantlerCreep extends Creep {
  role: "atd-dismantler";
}

export function isAttackTowerDrainAttacker(creep: Creep): creep is AttackTowerDrainAttackerCreep {
  return creep.memory.role === "atd-attacker";
}
export function isAttackTowerDrainHealer(creep: Creep): creep is AttackTowerDrainHealerCreep {
  return creep.memory.role === "atd-healer";
}
export function isAttackTowerDrainDismantler(creep: Creep): creep is AttackTowerDrainDismantlerCreep {
  return creep.memory.role === "atd-dismantler";
}
