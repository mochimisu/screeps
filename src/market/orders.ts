// Define sell orders.
// Status will be denoted in memory.
// Removing the order here will clear the memory

import { mainRoom } from "manager/room";

export interface ManualOrder {
  id: string;
  resourceType: ResourceConstant;
  price: number;
  amount: number;
  // for a deal, max energy
  energyAllowance: number;
  createDeal: boolean;
  type: "buy" | "sell";
}

const orders: ManualOrder[] = [
  {
    id: "sell-oxygen-mid-17",
    type: "sell",
    resourceType: RESOURCE_OXYGEN,
    price: 48,
    amount: 100_000,
    energyAllowance: 10_000,
    createDeal: true
  },
  {
    id: "sell-keanium-mid-3",
    type: "sell",
    resourceType: RESOURCE_KEANIUM,
    price: 145,
    amount: 100_000,
    energyAllowance: 10_000,
    createDeal: true
  },
  {
    id: "sell-energy-mid-0",
    type: "sell",
    resourceType: RESOURCE_ENERGY,
    price: 45,
    amount: 100_000,
    energyAllowance: 10_000,
    createDeal: true
  },
  {
    id: "buy-energy-low-0",
    type: "buy",
    resourceType: RESOURCE_ENERGY,
    price: 25,
    amount: 10000,
    energyAllowance: 1000,
    createDeal: true
  },
  {
    id: "buy-energy-mid-0",
    type: "buy",
    resourceType: RESOURCE_ENERGY,
    price: 30,
    amount: 10000,
    energyAllowance: 1000,
    createDeal: true
  },
  {
    id: "buy-energy-high-0",
    type: "buy",
    resourceType: RESOURCE_ENERGY,
    price: 35,
    amount: 10000,
    energyAllowance: 1000,
    createDeal: true
  }
];

const ordersById: Record<string, ManualOrder> = {};
for (const order of orders) {
  ordersById[order.id] = order;
}
const currentOrders = new Set<string>(orders.map(order => order.id));

declare global {
  interface Memory {
    orderState: {
      [id: string]: {
        status: "waiting" | "active" | "complete" | "failed";
        marketOrderId?: string;
      };
    };
  }
}

export function getActiveResources(): Partial<Record<ResourceConstant, number>> {
  const resourcesNeeded: Partial<Record<ResourceConstant, number>> = {};
  const sellMemory = getOrderMemory();
  // For every active order, add up the resources needed
  for (const order of orders) {
    const memory = sellMemory[order.id];
    if (memory != null && memory.status === "complete") {
      continue;
    }
    if (memory && memory.marketOrderId != null && order.type === "sell") {
      // use amount from market order remainingAmount
      const marketOrder = Game.market.getOrderById(memory.marketOrderId);
      if (marketOrder == null) {
        console.log(`Market order ${memory.marketOrderId} not found`);
        continue;
      }
      resourcesNeeded[order.resourceType] = (resourcesNeeded[order.resourceType] ?? 0) + marketOrder.remainingAmount;
    } else {
      if (order.type === "sell") {
        resourcesNeeded[order.resourceType] = (resourcesNeeded[order.resourceType] ?? 0) + order.amount;
      }
      if (!memory || memory.status !== "active") {
        // energy
        resourcesNeeded[RESOURCE_ENERGY] = (resourcesNeeded[RESOURCE_ENERGY] ?? 0) + order.energyAllowance;
      }
    }
  }
  return resourcesNeeded;
}

export function getNeededResources(): Partial<Record<ResourceConstant, number>> {
  const activeResources = getActiveResources();
  const terminal = Game.rooms[mainRoom].terminal;
  if (terminal == null) {
    return {};
  }
  for (const resourceType in terminal.store) {
    const resource = resourceType as ResourceConstant;
    activeResources[resource] = Math.max(
      (activeResources[resource] ?? 0) - terminal.store.getUsedCapacity(resourceType as ResourceConstant),
      0
    );
  }
  return activeResources;
}

export type FoundBuyOrder = Order & {
  txFee: number;
  totalPrice: number;
  pricePerUnit: number;
};

export function findHighestBuyOrder(
  resourceType: ResourceConstant,
  amount: number,
  maxEnergy?: number,
  energyCost = 35
): FoundBuyOrder | null {
  const allOrders = Game.market.getAllOrders();
  const buyOrders = allOrders.filter(
    order => order.resourceType === resourceType && order.type === ORDER_BUY && order.amount >= amount
  );
  // Add transaction cost
  const buyOrdersWithCost = buyOrders
    .map(order => {
      const amountCost = amount * order.price;
      if (order.roomName == null) {
        console.log("No room name for order", order);
        return null;
      }
      const txFee = Game.market.calcTransactionCost(amount, order.roomName, mainRoom);
      if (txFee > (maxEnergy || Infinity)) {
        // Exceeds cost
        console.log("Transaction fee exceeds max energy", txFee, maxEnergy);
        return null;
      }
      const txCost = txFee * energyCost;
      const totalPrice = amountCost - txCost;
      return {
        ...order,
        txFee,
        totalPrice,
        pricePerUnit: totalPrice / amount
      };
    })
    .filter(order => order != null) as FoundBuyOrder[];
  // Find the order with the highest price per unit
  const sortedOrders = _.sortBy(buyOrdersWithCost, order => -order.pricePerUnit);
  const bestOrder = sortedOrders[0];
  if (bestOrder == null) {
    console.log("No buy orders found");
    return null;
  }
  return bestOrder;
}

export type FoundSellOrder = Order & {
  txFee: number;
  totalPrice: number;
  pricePerUnit: number;
};

export function findLowestSellOrder(resourceType: ResourceConstant, amount: number): FoundSellOrder | null {
  const allOrders = Game.market.getAllOrders();
  const sellOrders = allOrders.filter(
    order => order.resourceType === resourceType && order.type === ORDER_SELL && order.amount >= amount
  );
  // Add transaction cost
  const sellOrdersWithCost = sellOrders.map(order => {
    const amountCost = amount * order.price;
    if (order.roomName == null) {
      console.log("No room name for order", order);
      return {
        ...order,
        txFee: Infinity,
        totalPrice: -Infinity,
        pricePerUnit: -Infinity
      };
    }
    const txFee = Game.market.calcTransactionCost(amount, order.roomName, mainRoom);
    const totalPrice = amountCost - txFee;
    return {
      ...order,
      txFee,
      totalPrice,
      pricePerUnit: totalPrice / amount
    };
  });

  // Find the order with the lowest total price
  const sortedOrders = _.sortBy(sellOrdersWithCost, order => order.totalPrice);
  const bestOrder = sortedOrders[0];
  if (bestOrder == null) {
    console.log("No sell orders found");
    return null;
  }
  return bestOrder;
}

export function getOrderMemory(): Memory["orderState"] {
  if (Memory.orderState == null) {
    Memory.orderState = {};
  }
  return Memory.orderState;
}

function resolveBuyOrder(order: ManualOrder): void {
  if (order.type !== "buy") {
    return;
  }
  const orderMemory = getOrderMemory();
  if (orderMemory[order.id].status !== "waiting") {
    return;
  }
  const energyInTerminal = Game.rooms[mainRoom].terminal?.store.getUsedCapacity(RESOURCE_ENERGY) || 0;
  const hasEnough = energyInTerminal >= order.energyAllowance;
  if (!hasEnough) {
    return;
  }
  console.log(`Order ${order.id} (${order.type}) has enough resources`);
  console.log("  Finding deal...");
  const bestOrder = findLowestSellOrder(order.resourceType, order.amount);
  if (bestOrder && bestOrder.pricePerUnit <= order.price) {
    console.log("  Found deal", bestOrder);
    // Make the deal
    const dealRes = Game.market.deal(bestOrder.id, order.amount, mainRoom);
    if (dealRes === OK) {
      console.log("  Deal successful");
      orderMemory[order.id].status = "complete";
      return;
    }
  }

  if (!order.createDeal) {
    orderMemory[order.id].status = "failed";
  } else if (order.createDeal) {
    console.log("  Creating buy order for", order.resourceType);
    const createResponse = Game.market.createOrder({
      type: ORDER_BUY,
      resourceType: order.resourceType,
      price: order.price,
      totalAmount: order.amount,
      roomName: mainRoom
    });
    if (createResponse !== OK) {
      console.log("  Failed to create order", createResponse);
      orderMemory[order.id].status = "failed";
    }
    orderMemory[order.id].status = "active";
  }
}

function resolveSellOrder(order: ManualOrder): void {
  if (order.type !== "sell") {
    return;
  }
  const orderMemory = getOrderMemory();
  if (orderMemory[order.id].status !== "waiting") {
    return;
  }

  const numInTerminal = Game.rooms[mainRoom].terminal?.store.getUsedCapacity(order.resourceType) || 0;
  const energyInTerminal = Game.rooms[mainRoom].terminal?.store.getUsedCapacity(RESOURCE_ENERGY) || 0;
  const hasEnough = numInTerminal >= order.amount && energyInTerminal >= order.energyAllowance;
  if (!hasEnough) {
    return;
  }

  console.log(`Order ${order.id} (${order.type}) has enough resources`);
  console.log("  Finding deal...");
  const bestOrder = findHighestBuyOrder(order.resourceType, order.amount, order.energyAllowance);
  if (bestOrder && bestOrder.pricePerUnit >= order.price) {
    console.log("  Found deal", bestOrder);
    // Make the deal
    const dealRes = Game.market.deal(bestOrder.id, order.amount, mainRoom);
    if (dealRes === OK) {
      console.log("  Deal successful");
      orderMemory[order.id].status = "complete";
      return;
    }
  }

  if (!order.createDeal) {
    orderMemory[order.id].status = "failed";
  } else if (order.createDeal) {
    console.log("  Creating sell order for", order.resourceType);
    const createResponse = Game.market.createOrder({
      type: ORDER_SELL,
      resourceType: order.resourceType,
      price: order.price,
      totalAmount: order.amount,
      roomName: mainRoom
    });
    if (createResponse === OK) {
      console.log("  Created sell order for", order.resourceType);
      orderMemory[order.id].status = "active";
    } else {
      console.log("  Failed to create order", createResponse);
      orderMemory[order.id].status = "failed";
    }
  }
}

export function orderLoop(): void {
  const memoryState = getOrderMemory();

  // If we don't have anything in memory, initialize it
  for (const order of orders) {
    if (memoryState[order.id] == null) {
      memoryState[order.id] = {
        status: "waiting"
      };
      console.log("New order", order.id);
    }
  }

  // If we have things in memory that we don't have orders for, remove them
  for (const id in memoryState) {
    if (!currentOrders.has(id)) {
      // If this has a market order, cancel it
      const marketOrderId = memoryState[id].marketOrderId;
      if (marketOrderId != null) {
        Game.market.cancelOrder(marketOrderId);
      }
      delete memoryState[id];
    }
  }

  // If status is waiting, and we have enough resources, find a deal or make a listing
  for (const order of orders) {
    if (order.type === "sell") {
      resolveSellOrder(order);
    } else if (order.type === "buy") {
      resolveBuyOrder(order);
    }
  }

  // Try to resolve any active orders without a marketOrderId
  for (const order of orders) {
    const orderState = memoryState[order.id];
    if (orderState.status === "active") {
      if (orderState.marketOrderId == null) {
        for (const marketOrderId in Game.market.orders) {
          const marketOrder = Game.market.orders[marketOrderId];
          if (
            order.type === "buy" &&
            marketOrder.type === ORDER_BUY &&
            marketOrder.resourceType === order.resourceType &&
            marketOrder.roomName === mainRoom &&
            marketOrder.remainingAmount === order.amount &&
            marketOrder.price === order.price
          ) {
            memoryState[order.id].marketOrderId = marketOrderId;
            console.log(`Found market order ${marketOrderId} for buy order ${order.id}`);
          } else if (
            order.type === "sell" &&
            marketOrder.type === ORDER_SELL &&
            marketOrder.resourceType === order.resourceType &&
            marketOrder.roomName === mainRoom &&
            marketOrder.remainingAmount === order.amount &&
            marketOrder.price === order.price
          ) {
            memoryState[order.id].marketOrderId = marketOrderId;
            console.log(`Found market order ${marketOrderId} for sell order ${order.id}`);
          }
        }
      } else {
        // Check if the order is complete
        const marketOrderId = orderState.marketOrderId;
        const marketOrder = Game.market.getOrderById(marketOrderId);
        if (marketOrder == null || marketOrder.remainingAmount === 0) {
          memoryState[order.id].status = "complete";
          console.log(`Order ${order.id} is complete`);
          if (marketOrder) {
            Game.market.cancelOrder(marketOrder.id);
          }
        }
      }
    }
  }
}
