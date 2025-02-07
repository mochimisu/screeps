import { findLowestSellOrder } from "utils/scripts";
import { SellOrder } from "./sell-orders";
import { mainRoom } from "manager/room";

// they are the same for now
type BuyOrder = SellOrder;

const buyOrders: BuyOrder[] = [
  {
    id: "test-3",
    resourceType: RESOURCE_HYDROGEN,
    price: 350,
    amount: 100,
    energyAllowance: 100,
    createDeal: true
  }
];

const buyOrdersById: Record<string, BuyOrder> = {};
for (const order of buyOrders) {
  buyOrdersById[order.id] = order;
}

const currentBuyOrderIds = new Set<string>(buyOrders.map(order => order.id));

declare global {
  interface Memory {
    buyOrderState: {
      [id: string]: {
        status: "waiting" | "active" | "complete" | "failed";
        marketOrderId?: string;
      };
    };
  }
}

export function getBuyMemory(): Memory["buyOrderState"] {
  if (!Memory.buyOrderState) {
    Memory.buyOrderState = {};
  }
  return Memory.buyOrderState;
}

// TODO need to do waiting state like buy order with energy
export function buyLoop(): void {
  const buyMemory = getBuyMemory();
  for (const order of buyOrders) {
    const memory = buyMemory[order.id];
    if (memory != null) {
      continue;
    }
    // Look for lowest sell order possible
    const foundOrder = findLowestSellOrder(order.resourceType, order.amount);
    if (foundOrder && foundOrder.pricePerUnit <= order.price) {
      // Found an order that is cheaper than the one we want to buy
      console.log(`Found a sell order deal ${order.resourceType}: ${foundOrder.pricePerUnit} vs ${order.price}`);
      // Make a deal
      const dealRes = Game.market.deal(foundOrder.id, order.amount, mainRoom);
      if (dealRes === OK) {
        console.log("Deal successful");
        buyMemory[order.id] = {
          status: "complete"
        };
        return;
      } else {
        console.log("Deal failed", dealRes);
      }
    }
    // Deal failed or didn't find a good deal, make a buy order
    console.log("Creating buy order", order);
    const createResponse = Game.market.createOrder({
      type: ORDER_BUY,
      resourceType: order.resourceType,
      price: order.price,
      totalAmount: order.amount,
      roomName: mainRoom
    });
    if (createResponse === OK) {
      buyMemory[order.id] = {
        status: "active"
      };
    } else {
      console.log("Failed to create order", createResponse);
      buyMemory[order.id] = {
        status: "failed"
      };
    }
  }

  // For any active orders without a marketOrderId, look for it
  for (const orderId in buyMemory) {
    const memory = buyMemory[orderId];
    if (memory.status === "active" && memory.marketOrderId == null) {
      for (const marketOrderId in Game.market.orders) {
        const marketOrder = Game.market.orders[marketOrderId];
        const order = buyOrdersById[orderId];
        if (
          marketOrder.type === ORDER_BUY &&
          marketOrder.resourceType === order.resourceType &&
          marketOrder.roomName === mainRoom &&
          marketOrder.remainingAmount === order.amount &&
          marketOrder.price === order.price
        ) {
          buyMemory[orderId].marketOrderId = marketOrderId;
          console.log(`Found market order ${buyMemory[orderId].marketOrderId} for buy order ${orderId}`);
        }
      }
    }
  }

  // For any active orders, check if they are complete
  for (const orderId in buyMemory) {
    const memory = buyMemory[orderId];
    if (memory.status === "active") {
      const marketOrderId = memory.marketOrderId;
      if (marketOrderId == null) {
        continue;
      }
      const marketOrder = Game.market.orders[marketOrderId];
      if (marketOrder == null || marketOrder.remainingAmount === 0) {
        buyMemory[orderId].status = "complete";
        console.log(`Buy order ${orderId} complete`);
      }
    }
  }
}
