export interface ControllerAttackerCreep extends Creep {
  role: "controller-attacker";
}

export function isControllerAttacker(creep: Creep): creep is ControllerAttackerCreep {
  return creep.memory.role === "controller-attacker";
}
