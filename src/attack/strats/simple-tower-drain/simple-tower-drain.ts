import { moveToIdleSpot } from "manager/idle";
import { spawnInRoom } from "manager/spawn";
import { ephemeral } from "screeps-clockwork";
import { ExitDirection } from "screeps-clockwork/dist/src/wasm/screeps_clockwork";
import { bodyPart } from "utils/body-part";
import { getAdjustedTerrainCostMatrix, getClockworkFlowMap } from "utils/clockwork";
import { Grid8Bit } from "utils/compact-grid";
import { creepsByRole, creepsByRoomAssignmentAndRole } from "utils/query";
import { atdAttackerLoop } from "./role.atd-attacker";
import {
  AttackTowerDrainAttackerCreep,
  AttackTowerDrainDismantlerCreep,
  AttackTowerDrainHealerCreep
} from "./role.type";
import { atdDismantlerLoop } from "./role.atd-dismantler";
import { atdHealerLoop } from "./role.atd-healer";

const DRAIN_DPS_MAX = 350;

export type TowerDrainStatus =
  | {
      // Create a scout and scout out tower and ramparts
      phase: "scout";
    }
  | {
      // Determine tower dps per location
      phase: "plan";
    }
  | {
      // If manual inspection is needed
      phase: "inspect";
    }
  | {
      // Spawn creeps to rally
      phase: "prep";
    }
  | {
      // Drain tower
      phase: "drain";
    }
  | {
      phase: "attack";
    }
  | {
      // Dismantle ramparts and tower
      phase: "dismantle";
    }
  | {
      // Done
      phase: "complete";
    };

export type TowerDrainStrategy = {
  type: "simple-tower-drain";
  fromRoom: string;
  status?: TowerDrainStatus;
  rallyId?: string;

  // Populated by scout
  scoutedTerrain?: string;
  towerPositions?: RoomPosition[];
  rampartHealthsRelative?: string;
  targetRamparts?: RoomPosition[];
  towerDpsMap?: string;
  tankMoveMap?: string;
  fromDirection?: ExitDirection;
};

export function scoutTerrain(room: Room): string {
  const terrain = room.getTerrain();
  const costMatrix = new PathFinder.CostMatrix();
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const terrainType = terrain.get(x, y);
      if (terrainType === TERRAIN_MASK_WALL) {
        costMatrix.set(x, y, 255);
      } else if (terrainType === TERRAIN_MASK_SWAMP) {
        costMatrix.set(x, y, 5);
      } else {
        costMatrix.set(x, y, 1);
      }
    }
  }
  return Grid8Bit.fromCostMatrix(costMatrix).serialize();
}

export function rampartHealthsRelative(room: Room) {
  // Scale from 0 to 200
  const ramparts = room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_RAMPART
  });
  const maxHealth = Math.max(...ramparts.map(r => r.hits));
  const minHealth = Math.min(...ramparts.map(r => r.hits));
  const range = maxHealth - minHealth;
  const grid = new Grid8Bit();
  for (const rampart of ramparts) {
    const relativeHealth = Math.floor(((rampart.hits - minHealth) / range) * 200);
    grid.set(rampart.pos.x, rampart.pos.y, relativeHealth);
  }
  // Set structures to 205
  const structures = room.find(FIND_STRUCTURES);
  for (const structure of structures) {
    grid.set(structure.pos.x, structure.pos.y, 205);
  }
  // Set walls to 210
  const walls = room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_WALL
  });
  for (const wall of walls) {
    grid.set(wall.pos.x, wall.pos.y, 210);
  }
  return grid.serialize();
}

export function rampartPath(
  serializedTerrain: string,
  serializedRampartHealths: string,
  towers: RoomPosition[],
  from: RoomPosition
) {
  // Construct a combined cost matrix for clockwork
  const combinedCostMatrix = Grid8Bit.fromSerialized(serializedRampartHealths);
  const terrain = Grid8Bit.fromSerialized(serializedTerrain);
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const terrainCost = terrain.get(x, y);
      // Add walls to the cost matrix
      if (terrainCost === 255) {
        combinedCostMatrix.set(x, y, 255);
      }
    }
  }
  // find a clockwork path
  const flowField = getClockworkFlowMap(() => ({
    from: [from],
    to: towers,
    costMatrix: (roomName: string) =>
      roomName === towers[0].roomName ? combinedCostMatrix.toCostMatrix() : getAdjustedTerrainCostMatrix(roomName)
  }));
  if (flowField == null) {
    return [];
  }
  ephemeral(flowField);

  // Convert paths to RoomPosition[]
  let curPos = from;
  const path: RoomPosition[] = [];
  while (true) {
    const direction = flowField.getDirections(curPos)[0];
    if (direction == null) {
      break;
    }
    path.push(new RoomPosition(curPos.x, curPos.y, curPos.roomName));
    if (direction === TOP) {
      curPos = new RoomPosition(curPos.x, curPos.y - 1, curPos.roomName);
    } else if (direction === TOP_RIGHT) {
      curPos = new RoomPosition(curPos.x + 1, curPos.y - 1, curPos.roomName);
    } else if (direction === RIGHT) {
      curPos = new RoomPosition(curPos.x + 1, curPos.y, curPos.roomName);
    } else if (direction === BOTTOM_RIGHT) {
      curPos = new RoomPosition(curPos.x + 1, curPos.y + 1, curPos.roomName);
    } else if (direction === BOTTOM) {
      curPos = new RoomPosition(curPos.x, curPos.y + 1, curPos.roomName);
    } else if (direction === BOTTOM_LEFT) {
      curPos = new RoomPosition(curPos.x - 1, curPos.y + 1, curPos.roomName);
    } else if (direction === LEFT) {
      curPos = new RoomPosition(curPos.x - 1, curPos.y, curPos.roomName);
    } else if (direction === TOP_LEFT) {
      curPos = new RoomPosition(curPos.x - 1, curPos.y - 1, curPos.roomName);
    }
  }
  // Filter to make sure there is a rampart or structure on the path
  return path.filter(p => {
    const look = p.look();
    return look.some(l => l.type === "structure");
  });
}

export function towerDpsMap(terrainSerialized: string, towerPositions: RoomPosition[]) {
  // Determine tower dps per location
  const terranGrid = Grid8Bit.fromSerialized(terrainSerialized);
  const towerDpsMap = new Grid8Bit();
  for (const towerPos of towerPositions) {
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        // Towers do TOWER_POWER_ATTACK within TOWER_OPTIMAL_RANGE
        // scaling down by TOWER_FALLOFF at TOWER_FALLOFF_RANGE
        // https://github.com/screeps/engine/blob/master/src/processor/intents/towers/attack.js#L38
        // Should be 600 at <=5, 150 at >=20
        const distance = Math.max(Math.abs(x - towerPos.x), Math.abs(y - towerPos.y));
        let dps = TOWER_POWER_ATTACK;
        if (distance > TOWER_OPTIMAL_RANGE) {
          let falloffDist = distance;
          if (distance > TOWER_FALLOFF_RANGE) {
            falloffDist = TOWER_FALLOFF_RANGE;
          }
          dps -=
            (TOWER_POWER_ATTACK * TOWER_FALLOFF * (falloffDist - TOWER_OPTIMAL_RANGE)) /
            (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
        }
        // Since DPS can scale high (600*4=2400 for 4 towers), we'll scale down by 50
        // and round up (max: 244*50=12200)
        const scaledDps = Math.ceil(dps / 50);
        const existingDps = towerDpsMap.get(x, y);
        let totalDps = existingDps + scaledDps;
        if (totalDps > 255) {
          console.log("total DPS > 255 @ " + x + "," + y + ": " + totalDps);
          console.log("  existing: " + existingDps);
          console.log("  scaled: " + scaledDps);
        }
        totalDps = Math.min(totalDps, 255);
        towerDpsMap.set(x, y, totalDps);
      }
    }
  }
  // Set terrain walls to 255
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      if (terranGrid.get(x, y) === 255) {
        towerDpsMap.set(x, y, 255);
      }
    }
  }
  return towerDpsMap.serialize();
}

export function tankMoveMap(dpsMapSerialized: string, fromDirection?: ExitDirection): string | null {
  const dpsThreshold = DRAIN_DPS_MAX;
  const dpsMap = Grid8Bit.fromSerialized(dpsMapSerialized);
  const costMatrix = new PathFinder.CostMatrix();
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const dps = dpsMap.get(x, y) * 50;
      if (dps >= dpsThreshold) {
        costMatrix.set(x, y, 255);
      }
    }
  }
  // Find the edge 1 pos in for fromDirection
  if (fromDirection) {
    let exitOpen = false;
    if (fromDirection === TOP) {
      for (let x = 0; x < 50; x++) {
        if (costMatrix.get(x, 1) !== 255) {
          exitOpen = true;
          break;
        }
      }
    } else if (fromDirection === BOTTOM) {
      for (let x = 0; x < 50; x++) {
        if (costMatrix.get(x, 48) !== 255) {
          exitOpen = true;
          break;
        }
      }
    } else if (fromDirection === LEFT) {
      for (let y = 0; y < 50; y++) {
        if (costMatrix.get(1, y) !== 255) {
          exitOpen = true;
          break;
        }
      }
    } else if (fromDirection === RIGHT) {
      for (let y = 0; y < 50; y++) {
        if (costMatrix.get(48, y) !== 255) {
          exitOpen = true;
          break;
        }
      }
    }
    if (!exitOpen) {
      console.log("Exit blocked for " + fromDirection);
      return null;
    }
  }
  return Grid8Bit.fromCostMatrix(costMatrix).serialize();
}

export function creepToRally(creep: Creep, strategy: TowerDrainStrategy) {
  // Move to the rally flag
  if (strategy.rallyId) {
    const rallyFlag = Game.flags[strategy.rallyId];
    if (rallyFlag) {
      creep.moveTo(rallyFlag);
      return true;
    }
  }
  return moveToIdleSpot(creep, strategy.fromRoom);
}
export function tankMoveCostCallback(strategy: TowerDrainStrategy) {
  return (_: string) => {
    if (strategy.tankMoveMap) {
      const mtx = Grid8Bit.fromSerialized(strategy.tankMoveMap).toCostMatrix();
      // make the bottom edge cost 255
      for (let x = 0; x < 50; x++) {
        mtx.set(x, 49, 255);
      }
      return mtx;
    }
    return undefined;
  };
}
