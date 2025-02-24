import { getNeededResources } from "market/orders";
import {
  getDesiredResourcesDelta,
  getExtraResources,
  getSiteResource,
  getSitesByRoom,
  getUsedRooms
} from "site/energy-storage-site/site";
import { mainRoom } from "./room";
import { keywiseFilter, keywiseMap, keywiseMin, keywiseSubtract } from "utils/etc";
import { query } from "utils/query";

export function terminalLoop() {
  // For each room, if it has extra materials, find the room to send it to
  const extraResourcesInRoom: Partial<Record<ResourceConstant, Partial<Record<string, number>>>> = {};
  for (const roomName of getUsedRooms()) {
    const room = Game.rooms[roomName];
    if (!room) {
      // console.log(`Room ${roomName} not found`);
      continue;
    }
    const terminal = room.terminal;
    if (!terminal) {
      // console.log(`Room ${roomName} has no terminal`);
      continue;
    }
    const extraResources = getExtraResources(roomName);
    const marketResources = roomName === mainRoom ? getNeededResources() : {};
    const resourcesInTerminal = keywiseSubtract(terminal.store, marketResources);
    const extraResourcesInTerminal = keywiseMin(extraResources, resourcesInTerminal);
    for (const [resourceTypeStr, amount] of Object.entries(extraResourcesInTerminal)) {
      if (amount <= 0) {
        continue;
      }
      const resourceType = resourceTypeStr as ResourceConstant;
      if (extraResourcesInRoom[resourceType] == null) {
        extraResourcesInRoom[resourceType] = {};
      }
      extraResourcesInRoom[resourceType][roomName] = amount;
    }
  }
  // console.log("extraResourcesInRoom", JSON.stringify(extraResourcesInRoom, null, 2));

  // Iterate down every room that needs resources and send from terminal
  for (const roomName of getUsedRooms()) {
    const room = Game.rooms[roomName];
    if (!room) {
      continue;
    }
    const terminal = room.terminal;
    if (!terminal) {
      continue;
    }
    const resourcesNeeded = keywiseFilter(getDesiredResourcesDelta(roomName), amount => amount > 0);
    // console.log("resourcesNeeded", roomName, JSON.stringify(resourcesNeeded, null, 2));
    for (const [resourceTypeStr, amountNeeded] of Object.entries(resourcesNeeded)) {
      // Find rooms with extra
      const resourceType = resourceTypeStr as ResourceConstant;
      const extraRoomResources = extraResourcesInRoom[resourceType];
      if (extraRoomResources == null) {
        continue;
      }
      for (const [sourceRoomName, extraAmount] of Object.entries(extraRoomResources)) {
        if (extraAmount == null || extraAmount <= 0) {
          continue;
        }
        const otherTerminal = Game.rooms[sourceRoomName].terminal;
        if (!otherTerminal) {
          continue;
        }
        let sendAmount = Math.min(extraAmount, amountNeeded ?? 0, otherTerminal.store[resourceType]);
        // console.log("sendAmount", sendAmount);
        // console.log("  extraAmount", extraAmount);
        // console.log("  amountNeeded", amountNeeded);
        const roomDistance = Game.map.getRoomLinearDistance(roomName, sourceRoomName);
        const energyCost = Math.ceil(sendAmount * (1 - Math.exp(-roomDistance / 30)));
        // TODO do the ajdjustment for other resources
        if (resourceType === RESOURCE_ENERGY) {
          sendAmount -= energyCost;
        }
        if (sendAmount <= 0) {
          continue;
        }
        const sendRes = otherTerminal.send(resourceType, sendAmount, roomName);
        if (sendRes === OK) {
          console.log(`Sent ${resourceType} (${sendAmount}) from ${sourceRoomName} to ${roomName}: ${sendRes}`);
        } else if (sendRes !== ERR_TIRED && sendRes !== ERR_NOT_ENOUGH_RESOURCES) {
          console.log(
            `Failed to send ${resourceType} (${sendAmount}) from ${sourceRoomName} to ${roomName}: ${sendRes}`
          );
        }
      }
    }
  }
}
