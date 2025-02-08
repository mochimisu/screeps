import { goToRoomAssignment } from "manager/room";
import { DismantlerCreep } from "./dismantler.type";

export function dismantlerLoop(creep: DismantlerCreep): void {
  if (goToRoomAssignment(creep)) {
    return;
  }

  // Find things to dismantle
  // Priority: Tower, Spawn, Storage, Container, Extension, Rampart
  const towers = creep.room
    .find(FIND_HOSTILE_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    })
    .sort((a, b) => a.hits - b.hits);
  const spawns = creep.room
    .find(FIND_HOSTILE_STRUCTURES, {
      filter: { structureType: STRUCTURE_SPAWN }
    })
    .sort((a, b) => a.hits - b.hits);
  const storages = creep.room
    .find(FIND_HOSTILE_STRUCTURES, {
      filter: { structureType: STRUCTURE_STORAGE }
    })
    .sort((a, b) => a.hits - b.hits);
  const containers = creep.room
    .find(FIND_HOSTILE_STRUCTURES, {
      filter: { structureType: STRUCTURE_CONTAINER }
    })
    .sort((a, b) => a.hits - b.hits);
  const extensions = creep.room
    .find(FIND_HOSTILE_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    })
    .sort((a, b) => a.hits - b.hits);
  const ramparts = creep.room
    .find(FIND_HOSTILE_STRUCTURES, {
      filter: { structureType: STRUCTURE_RAMPART }
    })
    .sort((a, b) => a.hits - b.hits);

  const targets = [...towers, ...spawns, ...storages, ...containers, ...extensions, ...ramparts];

  if (targets.length === 0) {
    return;
  }

  // Move and dismantle first target that we have a path to
  for (const target of targets) {
    if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
      const result = PathFinder.search(creep.pos, { pos: target.pos, range: 1 });
      if (result.incomplete) {
        continue;
      }
      creep.moveTo(target, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
      return;
    }
  }
}
