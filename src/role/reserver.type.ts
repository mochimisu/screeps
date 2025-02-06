interface ReserverMemory extends CreepMemory {
  role: "reserver";
  roomName: string;
}

export type ReserverCreep = Creep & {
  memory: ReserverMemory;
};

export function isReserver(creep: Creep): creep is ReserverCreep {
  return creep.memory.role === "reserver";
}
