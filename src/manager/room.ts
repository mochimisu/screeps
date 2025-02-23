export const mainRoom = "W22S58";
export const wipRooms = ["W22S59", "W21S58", "W21S59", "W21S57"];

export function getWipRooms(): Room[] {
  return wipRooms.map(roomName => Game.rooms[roomName]).filter(room => room != null);
}

export function getAllRooms(): Room[] {
  return [Game.rooms[mainRoom], ...getWipRooms()].filter(room => room != null);
}

export function getAllRoomNames(): string[] {
  return [mainRoom, ...wipRooms];
}

export function goToRoom(creep: Creep, roomName: string): boolean {
  if (creep.room.name !== roomName) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      visualizePathStyle: { stroke: "#ffffff" },
      reusePath: 20
    });
    // const exitDir = creep.room.findExitTo(roomName);
    // if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS || exitDir == null) {
    //   console.log(`No path to room ${roomName}`);
    //   return false;
    // }
    // const exit = creep.pos.findClosestByRange(exitDir);
    // if (!exit) {
    //   console.log(`No exit to room ${roomName}`);
    //   return false;
    // }
    // creep.moveTo(exit, {
    //   visualizePathStyle: { stroke: "#ffffff" }
    // });
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
