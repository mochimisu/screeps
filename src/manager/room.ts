export const mainRoom = "W22S58";
export const wipRooms = [
  "W22S59",
  "W21S58" // may not have vis
];

export function getWipRooms(): Room[] {
  return wipRooms.map(roomName => Game.rooms[roomName]);
}

export function getAllRooms(): Room[] {
  return [Game.rooms[mainRoom], ...getWipRooms()];
}

export function goToRoom(creep: Creep, roomName: string): boolean {
  if (creep.room.name !== roomName) {
    const exitDir = creep.room.findExitTo(roomName);
    if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS || exitDir == null) {
      console.log(`No path to room ${roomName}`);
      return false;
    }
    const exit = creep.pos.findClosestByRange(exitDir);
    if (!exit) {
      console.log(`No exit to room ${roomName}`);
      return false;
    }
    creep.moveTo(exit, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
    return true;
  }
  return false;
}

export function goToMainRoom(creep: Creep): boolean {
  return goToRoom(creep, mainRoom);
}

export function goToRoomAssignment(creep: Creep): boolean {
  if (creep.memory.roomName && creep.room.name !== creep.memory.roomName) {
    return goToRoom(creep, creep.memory.roomName);
  }
  return false;
}
