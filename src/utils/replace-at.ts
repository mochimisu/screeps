export function setReplaceAtForCurrentTick(creep: Creep, buffer?: number): void {
  if (creep.memory.born == null || creep.memory.replaceAt != null) {
    return;
  }
  // store when to spawn a new creep to replace this one
  const travelTime = Game.time - creep.memory.born;
  const spawnTime = creep.body.length * CREEP_SPAWN_TIME;
  const timeToLive = creep.ticksToLive;
  if (timeToLive == null) {
    console.log("No timeToLive for reserver: " + creep.name);
  } else {
    creep.memory.replaceAt = timeToLive - (travelTime + spawnTime + (buffer ?? 0)) + Game.time;
  }
}
