import { getSiteResource } from "site/energy-storage-site/site";

export const noMoveNodes: Map<string, (() => boolean) | null> = new Map<string, (() => boolean) | null>([
  // main energy
  ["5bbcabba9099fc012e6342c6", null],
  ["5bbcabba9099fc012e6342c5", null],
  // main oxygen
  [
    "5bbcb21d40062e4259e936b5",
    () =>
      getSiteResource("W22S58", RESOURCE_OXYGEN) < 100000 &&
      (Game.getObjectById<Mineral>("5bbcb21d40062e4259e936b5")?.mineralAmount ?? 0) > 0
  ],
  // 2nd energy
  ["5bbcabba9099fc012e6342c8", null]
]);

export function isNoMoveNode(sourceId: string): boolean {
  return noMoveNodes.has(sourceId);
}

export const noMoveNodesByRoom: { [roomName: string]: (Source | Mineral)[] } = {};
for (const nodeId of noMoveNodes.keys()) {
  const node = Game.getObjectById<Source | Mineral>(nodeId);
  if (!node?.room) {
    console.log("No node found for id: " + nodeId);
    continue;
  }
  const roomName = node.room.name;
  if (!noMoveNodesByRoom[roomName]) {
    noMoveNodesByRoom[roomName] = [];
  }
  noMoveNodesByRoom[roomName].push(node);
}
