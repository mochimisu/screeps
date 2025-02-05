import { onCreepDeath as builderOnCreepDeath, reset as resetBuilderManager } from "./builder";
import { onCreepDeath as harvesterOnCreepDeath, reset as resetHarvesterManager } from "./harvester";
import { mainRoom } from "./room";

export function cleanupDeath(): void {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      harvesterOnCreepDeath(name);
      builderOnCreepDeath(name);
    }
  }
}

export function periodicCleanup(): void {
  if (Game.time % 1000 === 0) {
    console.log(`periodic cleanup at ${Game.time}`);
    resetHarvesterManager();
    resetBuilderManager();
  }
}

export type Role =
  | "attacker"
  | "harvester"
  | "upgrader"
  | "builder"
  | "attackerRanged"
  | "claimer"
  | "janitor"
  | "repairer"
  | "harvester-nomove"
  | "ess-distributor"
  | "mule";
const roamingSpawns: Partial<Record<Role, number>> = {
  builder: 3,
  claimer: 0
};

function bodyPart(part: BodyPartConstant, count: number): BodyPartConstant[] {
  return Array(count).fill(part) as BodyPartConstant[];
}
const roomSpawns: Record<string, Partial<Record<Role, number>>> = {
  W22S58: {
    upgrader: 2,
    attacker: 0,
    janitor: 1,
    repairer: 1
  },
  W22S59: {
    attacker: 0,
    janitor: 1,
    repairer: 2,
    upgrader: 2
  }
};

const defaultParts: BodyPartConstant[] = [...bodyPart(WORK, 3), ...bodyPart(CARRY, 4), ...bodyPart(MOVE, 4)];
const parts: Partial<Record<Role, BodyPartConstant[]>> = {
  harvester: defaultParts,
  "harvester-nomove": [...bodyPart(WORK, 6), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 1)],
  upgrader: [...bodyPart(WORK, 4), ...bodyPart(CARRY, 4), ...bodyPart(MOVE, 5)],
  builder: defaultParts,
  attackerRanged: [...bodyPart(RANGED_ATTACK, 4), ...bodyPart(MOVE, 4), ...bodyPart(TOUGH, 5)],
  claimer: [...bodyPart(CLAIM, 1), ...bodyPart(MOVE, 4)],
  janitor: [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 5)],
  repairer: [...bodyPart(WORK, 3), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 4)]
};

function getPartsForRole(role: Role): BodyPartConstant[] {
  return parts[role] || defaultParts;
}

export function spawnInRoom(
  role: Role,
  options?: {
    roomName?: string;
    assignToRoom?: boolean;
    spawnElsewhereIfNeeded?: boolean;
    additionalMemory?: Record<string, any>;
    parts?: BodyPartConstant[];
  }
): boolean {
  const roomName = options?.roomName || mainRoom;

  // Find spawn in room
  const room = Game.rooms[roomName];
  const spawn = room && room.find(FIND_MY_SPAWNS)[0];
  // todo use real memory
  const memory: Record<string, any> = {
    role,
    ...options?.additionalMemory
  };
  if (options?.assignToRoom) {
    memory.roomName = roomName;
  }

  if (spawn) {
    const spawnParts = options?.parts ?? getPartsForRole(role);
    const newName = `${role}_${Game.time}`;
    if (
      spawn.spawnCreep(spawnParts, newName, {
        memory: memory as CreepMemory
      }) === OK
    ) {
      console.log("Spawned new " + role + " in " + roomName + ": " + newName + ". " + JSON.stringify(memory));
      return true;
    }
  }
  if (options?.spawnElsewhereIfNeeded) {
    const additionalMemory = options?.assignToRoom ? { ...options.additionalMemory, roomName } : { roomName };
    // Try main room
    if (
      spawnInRoom(role, {
        ...options,
        roomName: mainRoom,
        assignToRoom: false,
        additionalMemory
      })
    ) {
      return true;
    }
    // Try other rooms
    for (const spawnRoomName in Game.rooms) {
      if (
        spawnInRoom(role, {
          ...options,
          roomName: spawnRoomName,
          assignToRoom: false,
          additionalMemory
        })
      ) {
        return true;
      }
    }
  }
  return false;
}

export function spawnNeeded(): void {
  // Only try to spawn once per tick

  // Roaming spawns
  const roamingCreeps = _.filter(Game.creeps, creep => creep.memory.roomName == null);
  const roamingCreepCounts: Partial<Record<Role, number>> = {};
  for (const creep of roamingCreeps) {
    const role = creep.memory.role as Role;
    if (!roamingCreepCounts[role]) {
      roamingCreepCounts[role] = 0;
    }
    roamingCreepCounts[role]++;
  }
  // Spawn any missing roaming creeps
  for (const roleStr in roamingSpawns) {
    const role = roleStr as Role;
    const count = roamingCreepCounts[role] ?? 0;
    if (count < (roamingSpawns[role] ?? 0)) {
      // console.log("Roaming spawn needed: " + role);
      // console.log("counts: " + JSON.stringify(roamingCreepCounts));
      if (
        spawnInRoom(role, {
          roomName: mainRoom
        })
      ) {
        return;
      }
    }
  }

  // console.log("Roaming creeps: " + JSON.stringify(roamingCreepCounts));

  // Keep track of extra roaming creeps
  const extraRoamingCreeps: Partial<Record<Role, Creep[]>> = {};
  for (const roleStr in roamingSpawns) {
    const role = roleStr as Role;
    if ((roamingCreepCounts[role] ?? 0) > (roamingSpawns[role] ?? 0)) {
      const creeps = _.filter(roamingCreeps, creep => creep.memory.role === role);
      const extraCreeps = creeps.slice(roamingSpawns[role]);
      extraRoamingCreeps[role] = extraCreeps;
    }
  }

  // Room spawns
  for (const roomName in roomSpawns) {
    const room = Game.rooms[roomName];
    if (!room) {
      continue;
    }
    const creeps = _.filter(Game.creeps, creep => creep.memory.roomName === roomName);
    const creepCounts: Partial<Record<Role, number>> = {};
    for (const creep of creeps) {
      const role = creep.memory.role as Role;
      if (!creepCounts[role]) {
        creepCounts[role] = 0;
      }
      creepCounts[role]++;
    }
    // console.log("Room " + roomName + " creeps: " + JSON.stringify(creepCounts));
    // Spawn any missing creeps
    for (const roleStr in roomSpawns[roomName]) {
      const role = roleStr as Role;
      const count = creepCounts[role] || 0;
      if (count < (roomSpawns[roomName][role] ?? 0)) {
        // If we have an extra roaming creep, assign before spawning new
        if (extraRoamingCreeps[role] && extraRoamingCreeps[role].length > 0) {
          const extraCreep = extraRoamingCreeps[role].pop();
          if (extraCreep) {
            extraCreep.memory.roomName = roomName;
            console.log("Reassigned " + extraCreep.name + " to " + roomName);
          }
        } else if (spawnInRoom(role, { roomName, assignToRoom: true })) {
          return;
        }
      }
    }
  }
}

export function spawnLoop(): void {
  cleanupDeath();
  periodicCleanup();
  spawnNeeded();
}
