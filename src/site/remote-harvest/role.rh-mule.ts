import { goToRoomAssignment } from "manager/room";
import { RhSiteDef, getRhHarvester, getSiteByName } from "./site";
import { RhMuleCreep, isRhMule } from "./role.rh-mule.type";
import { ClockworkMultiroomFlowField } from "screeps-clockwork";
import { getCachedClockworkFlowMap, getSurroundingPositions, moveToWithClockwork } from "utils/clockwork";

function getEnergyCacheTransferPos(siteDef: RhSiteDef): RoomPosition[] {
  const energyCachePos = siteDef.energyCachePos?.();
  if (energyCachePos == null) {
    return [];
  }
  const harvestPos = siteDef.harvestPos();
  return getSurroundingPositions(energyCachePos).filter(p => p.x !== harvestPos.x || p.y !== harvestPos.y);
}

function getEnergyCachePaths(siteDef: RhSiteDef): ClockworkMultiroomFlowField[] {
  const energyCachePos = siteDef.energyCachePos?.();
  if (energyCachePos == null) {
    return [];
  }
  const firstSinkId = siteDef.sinks[0];
  const firstSink = Game.getObjectById<StructureContainer | StructureStorage | StructureLink>(firstSinkId);
  const energyCacheTransferPos = getSurroundingPositions(energyCachePos);
  const harvestPos = siteDef.harvestPos();
  const validEnergyCacheTransferPos = energyCacheTransferPos.filter(p => p.x !== harvestPos.x || p.y !== harvestPos.y);
  return [
    firstSink != null
      ? getCachedClockworkFlowMap(`rh-mule-${siteDef.name}-sink2cache`, () => ({
          from: getSurroundingPositions(firstSink.pos),
          to: validEnergyCacheTransferPos
        }))
      : null,
    getCachedClockworkFlowMap(`rh-mule-${siteDef.name}-idle2cache`, () => ({
      from: [siteDef.muleIdlePos()],
      to: validEnergyCacheTransferPos
    }))
  ].filter(f => f != null);
}

function getSinkPaths(siteDef: RhSiteDef): ClockworkMultiroomFlowField[] {
  const firstSinkId = siteDef.sinks[0];
  const firstSink = Game.getObjectById<StructureContainer | StructureStorage | StructureLink>(firstSinkId);
  if (firstSink == null) {
    return [];
  }
  const cacheTransferPos = getEnergyCacheTransferPos(siteDef);
  const sinkTransferPos = getSurroundingPositions(firstSink.pos);
  return [
    cacheTransferPos.length > 0 &&
      getCachedClockworkFlowMap(`rh-mule-${siteDef.name}-cache2sink`, () => ({
        from: cacheTransferPos,
        to: sinkTransferPos
      })),
    getCachedClockworkFlowMap(`rh-mule-${siteDef.name}-transfer2sink`, () => ({
      from: [siteDef.muleTransferPos()],
      to: sinkTransferPos
    }))
  ].filter(f => f != null && f !== false);
}

function getTransferPaths(siteDef: RhSiteDef): ClockworkMultiroomFlowField[] {
  const cacheTransferPos = getEnergyCacheTransferPos(siteDef);
  const transferPos = siteDef.muleTransferPos();
  return [
    cacheTransferPos.length > 0 &&
      getCachedClockworkFlowMap(`rh-mule-${siteDef.name}-cache2transfer`, () => ({
        from: cacheTransferPos,
        to: [transferPos]
      })),
    getCachedClockworkFlowMap(`rh-mule-${siteDef.name}-idle2transfer`, () => ({
      from: [siteDef.muleIdlePos()],
      to: [transferPos]
    }))
  ].filter(f => f != null && f !== false);
}

function getIdlePaths(siteDef: RhSiteDef): ClockworkMultiroomFlowField[] {
  const idlePos = siteDef.muleIdlePos();
  const firstSinkId = siteDef.sinks[0];
  const firstSink = Game.getObjectById<StructureContainer | StructureStorage | StructureLink>(firstSinkId);
  return [
    firstSink &&
      getCachedClockworkFlowMap(`rh-mule-${siteDef.name}-sink2idle`, () => ({
        from: getSurroundingPositions(firstSink.pos),
        to: [idlePos]
      }))
  ].filter(f => f != null);
}

export function rhMuleLoop(creep: RhMuleCreep): void {
  if (creep.store.getFreeCapacity() < 50) {
    creep.memory.status = "deposit";
  }
  if (creep.store.getUsedCapacity() === 0) {
    creep.memory.status = "withdraw";
  }

  const rhSiteDef = getSiteByName(creep.memory.rhSite);
  if (!rhSiteDef) {
    console.log("No site found for mule: " + creep.name);
    return;
  }

  if (creep.memory.status === "deposit") {
    // Deposit into the closest valid sink with room
    let sinks = rhSiteDef.sinks
      .map(sinkId => Game.getObjectById<StructureStorage | StructureContainer | StructureLink>(sinkId))
      .filter(s => s != null && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) as (
      | StructureStorage
      | StructureContainer
      | StructureLink
    )[];
    sinks = _.sortBy(sinks, s => creep.pos.getRangeTo(s));
    if (sinks.length === 0) {
      console.log("No sinks found for mule: " + creep.name);
      return;
    }
    const sink = sinks[0];

    const transferStatus = creep.transfer(sink, RESOURCE_ENERGY);
    if (transferStatus === ERR_NOT_IN_RANGE) {
      if (sink.id === rhSiteDef.sinks[0]) {
        moveToWithClockwork(creep, sink, getSinkPaths(rhSiteDef), { sayDebug: true });
      } else {
        creep.moveTo(sink, { reusePath: 10 });
      }
    }
  }

  if (creep.memory.status === "withdraw") {
    // Go to muleTransferPos if there's no one there, otherwise go to muleIdlePos
    const muleTransferPos = rhSiteDef.muleTransferPos();
    const muleIdlePos = rhSiteDef.muleIdlePos();

    if (muleTransferPos == null || muleIdlePos == null) {
      // No visibility, go to room
      if (goToRoomAssignment(creep)) {
        return;
      }
    }

    // If theres any dropped energy or tombstones with energy, grab those first
    const dropped = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: resource => resource.resourceType === RESOURCE_ENERGY
    });
    if (dropped.length > 0) {
      if (creep.pickup(dropped[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(dropped[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }
    const tombstones = creep.room.find(FIND_TOMBSTONES, {
      filter: tombstone => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (tombstones.length > 0) {
      if (creep.withdraw(tombstones[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(tombstones[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }
    // If we have a structure at energyCachePos, grab from there
    if (rhSiteDef.energyCachePos) {
      const energyCachePos = rhSiteDef.energyCachePos();
      const energyCache = energyCachePos
        .lookFor(LOOK_STRUCTURES)
        .filter(
          s =>
            (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
            (s as StructureContainer | StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > 0
        )[0];
      if (energyCache) {
        if (creep.withdraw(energyCache, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          moveToWithClockwork(creep, energyCache, getEnergyCachePaths(rhSiteDef), { sayDebug: true });
        }
        return;
      }
    }

    try {
      const creepsAtMuleTransferPos = muleTransferPos.lookFor(LOOK_CREEPS);
      if (creepsAtMuleTransferPos.length === 0) {
        moveToWithClockwork(creep, muleTransferPos, getTransferPaths(rhSiteDef), { sayDebug: true });
        return;
      } else if (creepsAtMuleTransferPos[0].name === creep.name) {
        return;
      }
    } catch (e) {
      // console.log("Error in muleTransferPos: " + e);
    }
    creep.moveTo(muleIdlePos);
  }
}
