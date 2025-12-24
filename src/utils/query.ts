// store things with a cache time in ticks, by default this is just in 1 tick
//

import { Grid8Bit } from "./compact-grid";

declare global {
  interface Memory {
    query: {
      [key: string]: {
        value: any;
        cacheUntil: number;
      };
    };
  }
}

let perTickMemory: { [key: string]: any } = {};
let perTickMemoryUpdated = 0;

export function queryLoop(): void {
  if (Game.time !== perTickMemoryUpdated) {
    perTickMemory = {};
    perTickMemoryUpdated = Game.time;
  }
}

export function query<T>(key: string, getter: () => T, cacheTime = 1): T {
  if (cacheTime <= 1) {
    return perTickQuery(key, getter);
  }
  if (Memory.query == null) {
    Memory.query = {};
  }
  const queryVal = Memory.query[key];
  if (queryVal == null || queryVal.cacheUntil < Game.time) {
    const value = getter();
    Memory.query[key] = {
      value,
      cacheUntil: Game.time + cacheTime
    };
    return value;
  }
  return queryVal.value as T;
}

export function queryId<T extends _HasId>(key: string, getter: () => T | null, cacheTime = 1): T | null {
  const id: Id<T> | null = query<string | null>(key, () => getter()?.id ?? null, cacheTime) as Id<T> | null;
  return id != null ? Game.getObjectById(id) : null;
}

export function queryIds<T extends _HasId>(key: string, getter: () => T[], cacheTime = 1): T[] {
  const ids: Id<T>[] = query<string[]>(key, () => getter().map(o => o.id), cacheTime) as Id<T>[];
  return ids.map(id => Game.getObjectById(id) as T).filter(o => o != null);
}

export function perTickQuery<T>(key: string, getter: () => T): T {
  if (Game.time !== perTickMemoryUpdated) {
    perTickMemory = {};
    perTickMemoryUpdated = Game.time;
  }
  let val = perTickMemory[key];
  if (val == null) {
    val = getter();
    perTickMemory[key] = val;
  }
  return val as T;
}
export function queryCostMatrix(key: string, getter: () => CostMatrix, cacheTime = 100): CostMatrix {
  if (cacheTime <= 1) {
    return perTickQuery(key, getter);
  }
  const tickCacheKey = `tickCache-queryCostMatrix-${key}`;
  if (perTickMemory[tickCacheKey] != null) {
    return perTickMemory[tickCacheKey];
  }
  const grid8 = Grid8Bit.fromSerialized(query(key, () => Grid8Bit.fromCostMatrix(getter()).serialize(), cacheTime));
  const costMatrix = grid8.toCostMatrix();
  perTickMemory[tickCacheKey] = costMatrix;
  return costMatrix;
}

export function creepsByRole(role: string): Creep[] {
  const byRole = query(`creepsByRole`, () => {
    const ret: { [role: string]: Creep[] } = {};
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const creepRole = creep.memory.role ?? "";
      if (ret[creepRole] == null) {
        ret[creepRole] = [];
      }
      ret[creepRole].push(creep);
    }
    return ret;
  });
  return byRole[role] ?? [];
}

export function creepsByRoomAssignment(roomName: string): Creep[] {
  const byRoom = query(`creepsByRoomAssignment`, () => {
    const ret: { [roomName: string]: Creep[] } = {};
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const assignment = creep.memory.roomName ?? "";
      if (ret[assignment] == null) {
        ret[assignment] = [];
      }
      ret[assignment].push(creep);
    }
    return ret;
  });
  return byRoom[roomName] ?? [];
}

export function creepsByRoomAssignmentAndRole(roomName: string, role: string): Creep[] {
  const byRoomAndRole = allCreepsByRoomAssignmentAndRole();
  return byRoomAndRole[roomName]?.[role] ?? [];
}

export function allCreepsByRoomAssignmentAndRole(): { [roomName: string]: { [role: string]: Creep[] } } {
  return query(`allCreepsByRoomAssignmentAndRole`, () => {
    const ret: { [roomName: string]: { [role: string]: Creep[] } } = {};
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      const assignment = creep.memory.roomName ?? "";
      const creepRole = creep.memory.role ?? "";
      if (ret[assignment] == null) {
        ret[assignment] = {};
      }
      if (ret[assignment][creepRole] == null) {
        ret[assignment][creepRole] = [];
      }
      ret[assignment][creepRole].push(creep);
    }
    return ret;
  });
}

// not sure if these are faster/lower cpu
export function structureTypesAtPos(
  pos: RoomPosition,
  structureTypes: Set<StructureConstant>,
  cacheTime = 10
): Structure[] | null {
  return queryIds(
    `structureAtPos-${pos.roomName}:${pos.x},${pos.y}-${Array.from(structureTypes).join(",")}`,
    () => {
      return pos.lookFor(LOOK_STRUCTURES).filter(s => structureTypes.has(s.structureType));
    },
    cacheTime
  );
}

export function structureAtPos(
  pos: RoomPosition,
  structureType: StructureConstant,
  cacheTime = 10
): Structure[] | null {
  return structureTypesAtPos(pos, new Set([structureType]), cacheTime);
}
