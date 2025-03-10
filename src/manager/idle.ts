interface IdleZone {
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;
}

const zones: { [roomName: string]: IdleZone[] } = {
  W22S58: [{ xStart: 28, yStart: 28, xEnd: 35, yEnd: 32 }],
  W22S59: [{ xStart: 13, yStart: 31, xEnd: 23, yEnd: 38 }],
  W21S58: [{ xStart: 23, yStart: 28, xEnd: 24, yEnd: 30 }],
  W21S59: [{ xStart: 22, yStart: 3, xEnd: 32, yEnd: 4 }],
  W21S57: [{ xStart: 25, yStart: 46, xEnd: 29, yEnd: 47 }],
  W22S57: [{ xStart: 31, yStart: 28, xEnd: 33, yEnd: 30 }]
};

export function moveToIdleSpot(creep: Creep, roomName?: string): boolean {
  const idleZones = zones[roomName ?? creep.room.name];
  if (!idleZones) {
    return false;
  }

  // If in an idle spot, just return
  for (const idleZone of idleZones) {
    if (
      creep.pos.x >= idleZone.xStart &&
      creep.pos.x <= idleZone.xEnd &&
      creep.pos.y >= idleZone.yStart &&
      creep.pos.y <= idleZone.yEnd
    ) {
      return true;
    }
  }

  // Find an idle spot without a creep
  for (const idleZone of idleZones) {
    for (let x = idleZone.xStart; x <= idleZone.xEnd; x++) {
      for (let y = idleZone.yStart; y <= idleZone.yEnd; y++) {
        const objects = creep.room.lookAt(x, y);
        const hasCreep = objects.find(o => o.type === "creep");
        if (!hasCreep) {
          creep.moveTo(x, y, { reusePath: 20 });
          return true;
        }
      }
    }
  }
  return false;
}
