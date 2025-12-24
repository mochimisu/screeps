interface NoMoveDefinition {
  sourceId: string;
  predicate?: () => boolean;
  allowOtherRoomSpawn?: boolean;
}

export const noMoveNodes: NoMoveDefinition[] = [
  // main energy
  { sourceId: "5bbcabba9099fc012e6342c6" },
  { sourceId: "5bbcabba9099fc012e6342c5" },
  // main oxygen
  {
    sourceId: "5bbcb21d40062e4259e936b5",
    predicate: () =>
      (Game.getObjectById<Mineral>("5bbcb21d40062e4259e936b5")?.mineralAmount ?? 0) > 0 &&
      (Game.getObjectById<StructureStorage>("679a16c3135bf04cc4b9f12e")?.store.getFreeCapacity() ?? 0) > 100000 &&
      (Game.getObjectById<StructureStorage>("679a16c3135bf04cc4b9f12e")?.store.getUsedCapacity(RESOURCE_OXYGEN) ?? 0) <
        200_000
  },
  // 2nd energy
  {
    sourceId: "5bbcabba9099fc012e6342c8",
    allowOtherRoomSpawn: true
  },
  // 2nd keanium
  {
    sourceId: "5bbcb21d40062e4259e936b6",
    predicate: () =>
      (Game.getObjectById<Mineral>("5bbcb21d40062e4259e936b6")?.mineralAmount ?? 0) > 0 &&
      (Game.getObjectById<StructureStorage>("67a143d162f5371cbb7bb49b")?.store.getFreeCapacity() ?? 0) > 100000 &&
      (Game.getObjectById<StructureStorage>("67a143d162f5371cbb7bb49b")?.store.getUsedCapacity(RESOURCE_KEANIUM) ?? 0) <
        200_000
  },
  // 3rd energy
  {
    sourceId: "5bbcabc79099fc012e634450",
    allowOtherRoomSpawn: true
  },
  // 3rd oxygen
  {
    sourceId: "5bbcb22840062e4259e93721",
    predicate: () =>
      (Game.getObjectById<Mineral>("5bbcb22840062e4259e93721")?.mineralAmount ?? 0) > 0 &&
      (Game.getObjectById<StructureStorage>("67ab4af7918897273c038658")?.store.getFreeCapacity() ?? 0) > 100000 &&
      (Game.getObjectById<StructureStorage>("67ab4af7918897273c038658")?.store.getUsedCapacity(RESOURCE_OXYGEN) ?? 0) <
        200_000
  }
];

export const noMoveNodesById: Map<string, NoMoveDefinition> = new Map();
for (const def of noMoveNodes) {
  noMoveNodesById.set(def.sourceId, def);
}

export function isNoMoveNode(sourceId: string): boolean {
  return noMoveNodesById.has(sourceId);
}

export const noMoveNodesByRoom: { [roomName: string]: (Source | Mineral)[] } = {};
for (const def of noMoveNodes) {
  const node = Game.getObjectById<Source | Mineral>(def.sourceId);
  if (!node?.room) {
    console.log("No node found for id: " + def.sourceId);
    continue;
  }
  const roomName = node.room.name;
  if (!noMoveNodesByRoom[roomName]) {
    noMoveNodesByRoom[roomName] = [];
  }
  noMoveNodesByRoom[roomName].push(node);
}
