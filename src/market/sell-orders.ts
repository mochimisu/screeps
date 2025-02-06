// Define sell orders.
// Status will be denoted in memory.
// Removing the order here will clear the memory

import { mainRoom } from "manager/room";
import { findHighestBuyOrder } from "utils/scripts";

interface SellOrder {
  id: string;
  resourceType: ResourceConstant;
  price: number;
  amount: number;
  // for a deal, max energy
  energyAllowance: number;
  createDeal: boolean;
}

const sellOrders: SellOrder[] = [
  {
    id: "test10",
    resourceType: RESOURCE_OXYGEN,
    price: 40,
    amount: 500,
    energyAllowance: 100,
    createDeal: true
  }
];

const sellOrdersById: Record<string, SellOrder> = {};
for (const order of sellOrders) {
  sellOrdersById[order.id] = order;
}

const currentSellOrderIds = new Set<string>(sellOrders.map(order => order.id));

declare global {
  interface Memory {
    sellOrderState: {
      [id: string]: {
        resourceType: ResourceConstant;
        status: "waiting" | "active" | "complete" | "failed";
        marketOrderId?: string;
      };
    };
  }
}

export function getActiveResources(): Map<ResourceConstant, number> {
  const resourcesNeeded: Map<ResourceConstant, number> = new Map();
  const sellMemory = getSellMemory();
  // For every active order, add up the resources needed
  for (const order of sellOrders) {
    const memory = sellMemory[order.id];
    if (memory != null && memory.status === "complete") {
      continue;
    }
    resourcesNeeded.set(order.resourceType, (resourcesNeeded.get(order.resourceType) || 0) + order.amount);
    // energy
    resourcesNeeded.set(RESOURCE_ENERGY, (resourcesNeeded.get(RESOURCE_ENERGY) || 0) + order.energyAllowance);
  }
  return resourcesNeeded;
}

export function getNeededResources(): Map<ResourceConstant, number> {
  const activeResources = getActiveResources();
  const terminal = Game.rooms[mainRoom].terminal;
  if (terminal == null) {
    return new Map();
  }
  for (const resourceType in terminal.store) {
    activeResources.set(
      resourceType as ResourceConstant,
      Math.max(
        (activeResources.get(resourceType as ResourceConstant) || 0) -
          terminal.store.getUsedCapacity(resourceType as ResourceConstant),
        0
      )
    );
  }
  return activeResources;
}

export function getSellMemory(): Memory["sellOrderState"] {
  if (Memory.sellOrderState == null) {
    Memory.sellOrderState = {};
  }
  return Memory.sellOrderState;
}

export function sellLoop(): void {
  const sellMemory = getSellMemory();

  // If we don't have anything in memory, initialize it
  for (const order of sellOrders) {
    if (sellMemory[order.id] == null) {
      sellMemory[order.id] = {
        resourceType: order.resourceType,
        status: "waiting"
      };
    }
  }

  // If we have things in memory that we don't have orders for, remove them
  for (const id in sellMemory) {
    if (!currentSellOrderIds.has(id)) {
      delete sellMemory[id];
    }
  }

  // If amount is 0, and status is "waiting", make a new sell order
  for (const order of sellOrders) {
    const orderState = sellMemory[order.id];
    const numInTerminal = Game.rooms[mainRoom].terminal?.store.getUsedCapacity(order.resourceType) || 0;
    const hasEnough = numInTerminal >= order.amount;
    if (hasEnough && orderState.status === "waiting") {
      console.log(`Order ${order.id} has enough resources`);
      console.log("  Finding deal...");
      const bestOrder = findHighestBuyOrder(order.resourceType, order.amount, order.energyAllowance);
      if (bestOrder && bestOrder.pricePerUnit >= order.price) {
        console.log("  Found deal", bestOrder);
        sellMemory[order.id].status = "active";
        // Make the deal
        const dealRes = Game.market.deal(bestOrder.id, order.amount, mainRoom);
        console.log("  Deal result", dealRes);
        if (dealRes === OK) {
          return;
        }
      } else if (order.createDeal) {
        console.log("Creating sell order for", order.resourceType);
        const createResponse = Game.market.createOrder({
          type: ORDER_SELL,
          resourceType: order.resourceType,
          price: order.price,
          totalAmount: order.amount,
          roomName: mainRoom
        });
        if (createResponse !== OK) {
          console.log("Failed to create order", createResponse);
          sellMemory[order.id].status = "failed";
        }
        sellMemory[order.id].status = "active";
        // Find the order in the market
        for (const marketOrderId in Game.market.orders) {
          const marketOrder = Game.market.orders[marketOrderId];
          if (
            marketOrder.type === ORDER_SELL &&
            marketOrder.resourceType === order.resourceType &&
            marketOrder.roomName === mainRoom &&
            marketOrder.remainingAmount === order.amount &&
            marketOrder.price === order.price
          ) {
            sellMemory[order.id].marketOrderId = marketOrderId;
          }
        }
      } else {
        sellMemory[order.id].status = "active";
      }
    }
  }

  // For any active orders, check if they are complete
  for (const order of sellOrders) {
    const orderState = sellMemory[order.id];
    if (orderState.status === "active") {
      let marketOrderId = orderState.marketOrderId;
      if (marketOrderId == null) {
        // Find the market order
        for (const potentialMarketOrderId in Game.market.orders) {
          const potentialMarketOrder = Game.market.orders[potentialMarketOrderId];
          if (
            potentialMarketOrder.type === ORDER_SELL &&
            potentialMarketOrder.resourceType === order.resourceType &&
            potentialMarketOrder.roomName === mainRoom &&
            potentialMarketOrder.amount === order.amount &&
            potentialMarketOrder.price === order.price
          ) {
            sellMemory[order.id].marketOrderId = potentialMarketOrderId;
            console.log(`Found market order ${potentialMarketOrderId} for sell order ${order.id}`);
            marketOrderId = potentialMarketOrderId;
            break;
          }
        }
      }
      if (marketOrderId == null) {
        console.log(`No market order found for sell order ${order.id}`);
        continue;
      }
      const marketOrder = Game.market.getOrderById(marketOrderId);
      if (marketOrder == null) {
        sellMemory[order.id].status = "complete";
        console.log(`Sell order ${order.id} is complete`);
      }
    }
  }
}
