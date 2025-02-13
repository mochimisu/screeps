import { bodyPart } from "utils/body-part";
import { onCreepDeath as harvesterOnCreepDeath, reset as resetHarvesterManager } from "./harvester";
import { mainRoom } from "./room";
import { allCreepsByRoomAssignmentAndRole } from "utils/query";

export function cleanupDeath(): void {
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      harvesterOnCreepDeath(name);
    }
  }
}

export function periodicCleanup(): void {
  if (Game.time % 1000 === 0) {
    console.log(`periodic cleanup at ${Game.time}`);
    resetHarvesterManager();
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
  | "mule"
  | "rh-mule"
  | "rh-harvester"
  | "reserver"
  | "upgrader-nomove"
  | "dismantler";
const roamingSpawns: Partial<Record<Role, number>> = {};

const roomSpawns: Record<string, Partial<Record<Role, number>>> = {
  W22S58: {
    janitor: 1,
    repairer: 1
  },
  W22S59: {
    janitor: 1,
    repairer: 1
  },
  W21S58: {
    repairer: 1
  },
  W21S59: {
    reserver: 1,
    repairer: 1
  }
};

const defaultParts: BodyPartConstant[] = [...bodyPart(WORK, 3), ...bodyPart(CARRY, 4), ...bodyPart(MOVE, 4)];
const parts: Partial<Record<Role, BodyPartConstant[]>> = {
  harvester: defaultParts,
  "harvester-nomove": [...bodyPart(WORK, 6), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 3)],
  upgrader: [...bodyPart(WORK, 4), ...bodyPart(CARRY, 4), ...bodyPart(MOVE, 5)],
  builder: [...bodyPart(WORK, 4), ...bodyPart(CARRY, 8), ...bodyPart(MOVE, 6)],
  attackerRanged: [...bodyPart(RANGED_ATTACK, 4), ...bodyPart(MOVE, 4), ...bodyPart(TOUGH, 5)],
  claimer: [...bodyPart(CLAIM, 1), ...bodyPart(MOVE, 4)],
  janitor: [...bodyPart(CARRY, 4), ...bodyPart(MOVE, 5)],
  repairer: [...bodyPart(WORK, 5), ...bodyPart(CARRY, 6), ...bodyPart(MOVE, 6)],
  "rh-harvester": [...bodyPart(WORK, 5), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 5)],
  "rh-mule": [...bodyPart(CARRY, 3), ...bodyPart(MOVE, 3)],
  // reserver: [CLAIM, CLAIM, MOVE, MOVE]
  reserver: [CLAIM, MOVE],
  "upgrader-nomove": [...bodyPart(WORK, 8), ...bodyPart(CARRY, 3), ...bodyPart(MOVE, 2)],
  dismantler: [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE]
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

  if (spawn) {
    const spawnParts = options?.parts ?? getPartsForRole(role);
    const newName = `${role}_${Game.time}`;
    const memory: Record<string, any> = {
      role,
      born: Game.time + spawnParts.length * CREEP_SPAWN_TIME,
      ...options?.additionalMemory
    };
    if (options?.assignToRoom) {
      memory.roomName = roomName;
    }
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
    const additionalMemory = options?.assignToRoom
      ? { ...options.additionalMemory, roomName }
      : { ...options.additionalMemory };
    // Try main room
    if (
      spawnInRoom(role, {
        ...options,
        roomName: mainRoom,
        assignToRoom: false,
        spawnElsewhereIfNeeded: false,
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
          spawnElsewhereIfNeeded: false,
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
  const creepsByRoomAndRole = allCreepsByRoomAssignmentAndRole();

  // Roaming spawns
  const roamingCreeps = creepsByRoomAndRole[""] ?? {};
  const roamingCreepCounts: Partial<Record<Role, number>> = {};
  const extraRoamingCreeps: Partial<Record<Role, Creep[]>> = {};
  for (const roleStr in roamingSpawns) {
    const role = roleStr as Role;
    if (!roamingCreepCounts[role]) {
      roamingCreepCounts[role] = 0;
    }
    roamingCreepCounts[role] = roamingCreeps[role]?.length ?? 0;
    // Keep track of extra roaming creeps
    extraRoamingCreeps[role] = roamingCreeps[role]?.slice(roamingSpawns[role] ?? 0);
  }

  // Spawn any missing roaming creeps
  for (const roleStr in roamingSpawns) {
    const role = roleStr as Role;
    const count = roamingCreepCounts[role] ?? 0;
    if (count < (roamingSpawns[role] ?? 0)) {
      if (
        spawnInRoom(role, {
          roomName: mainRoom
        })
      ) {
        return;
      }
    }
  }

  // Room spawns
  for (const roomName in roomSpawns) {
    const creeps = creepsByRoomAndRole[roomName] ?? [];
    const creepCounts: Partial<Record<Role, number>> = {};
    for (const roleStr in roomSpawns[roomName]) {
      const role = roleStr as Role;
      if (!creepCounts[role]) {
        creepCounts[role] = 0;
      }
      creepCounts[role] = creeps[role]?.length ?? 0;
    }

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
        } else if (spawnInRoom(role, { roomName, assignToRoom: true, spawnElsewhereIfNeeded: true })) {
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
