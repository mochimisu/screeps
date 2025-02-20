// Look at the edges of the room to find actual roomposition of exits
export function findUnfriendlyExitPositions(roomName: string): RoomPosition[] {
  const terrain = new Room.Terrain(roomName);
  if (!terrain) {
    return [];
  }
  const positions = [];
  // top edge
  const northRoomName = getAdjacentRoomName(roomName, TOP);
  const northRoom = Game.rooms[northRoomName];
  if (!northRoom || !northRoom.controller || !northRoom.controller.my) {
    for (let x = 0; x < 50; x++) {
      if (terrain.get(x, 0) !== TERRAIN_MASK_WALL) {
        positions.push(new RoomPosition(x, 0, roomName));
      }
    }
  }
  // bottom edge
  const southRoomName = getAdjacentRoomName(roomName, BOTTOM);
  const southRoom = Game.rooms[southRoomName];
  if (!southRoom || !southRoom.controller || !southRoom.controller.my) {
    for (let x = 0; x < 50; x++) {
      if (terrain.get(x, 49) !== TERRAIN_MASK_WALL) {
        positions.push(new RoomPosition(x, 49, roomName));
      }
    }
  }
  // left edge
  const westRoomName = getAdjacentRoomName(roomName, LEFT);
  const westRoom = Game.rooms[westRoomName];
  if (!westRoom || !westRoom.controller || !westRoom.controller.my) {
    for (let y = 0; y < 50; y++) {
      if (terrain.get(0, y) !== TERRAIN_MASK_WALL) {
        positions.push(new RoomPosition(0, y, roomName));
      }
    }
  }
  // right edge
  const eastRoomName = getAdjacentRoomName(roomName, RIGHT);
  const eastRoom = Game.rooms[eastRoomName];
  if (!eastRoom || !eastRoom.controller || !eastRoom.controller.my) {
    for (let y = 0; y < 50; y++) {
      if (terrain.get(49, y) !== TERRAIN_MASK_WALL) {
        positions.push(new RoomPosition(49, y, roomName));
      }
    }
  }
  return positions;
}

export function findUniqueUnfriendlyExitPositions(roomName: string): RoomPosition[] {
  // return only exit positions that don't touch each other
  const exitPositions = findUnfriendlyExitPositions(roomName);
  const uniquePositions = [];
  let lastPos = null;
  for (const pos of exitPositions) {
    if (!lastPos || pos.getRangeTo(lastPos) > 1) {
      uniquePositions.push(pos);
    }
    lastPos = pos;
  }
  return uniquePositions;
}
function getAdjacentRoomName(roomName: string, direction: number): string {
  // Regular expression to parse the room name
  const match = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName);
  if (!match) {
    throw new Error("Invalid room name");
  }

  // Extract components from the room name
  let [, horDir, horCoordStr, verDir, verCoordStr] = match;
  let horCoord = parseInt(horCoordStr, 10);
  let verCoord = parseInt(verCoordStr, 10);

  // Adjust coordinates based on the direction
  switch (direction) {
    case TOP:
      verCoord += verDir === "N" ? 1 : -1;
      if (verCoord < 0) {
        verCoord = Math.abs(verCoord) - 1;
        verDir = verDir === "N" ? "S" : "N";
      }
      break;
    case BOTTOM:
      verCoord += verDir === "N" ? -1 : 1;
      if (verCoord < 0) {
        verCoord = Math.abs(verCoord) - 1;
        verDir = verDir === "N" ? "S" : "N";
      }
      break;
    case LEFT:
      horCoord += horDir === "W" ? 1 : -1;
      if (horCoord < 0) {
        horCoord = Math.abs(horCoord) - 1;
        horDir = horDir === "W" ? "E" : "W";
      }
      break;
    case RIGHT:
      horCoord += horDir === "W" ? -1 : 1;
      if (horCoord < 0) {
        horCoord = Math.abs(horCoord) - 1;
        horDir = horDir === "W" ? "E" : "W";
      }
      break;
    default:
      throw new Error("Invalid direction");
  }

  return `${horDir}${horCoord}${verDir}${verCoord}`;
}
