import {
  findHighestBuyOrder as findHighestBuyOrderImpl,
  findLowestSellOrder as findLowestSellOrderImpl,
  FoundBuyOrder,
  FoundSellOrder
} from "market/orders";

export function numMovePartsNeeded(parts: BodyPartConstant[], terrain: "road" | "plains" | "swamp" = "plains"): number {
  const terrainFactor = terrain === "road" ? 0.5 : terrain === "plains" ? 1 : 1.5;
  const nonMoveParts = parts.filter(part => part !== MOVE);
  const withoutCarry = nonMoveParts.filter(part => part !== CARRY);

  const nonMoveNumMove = Math.ceil(nonMoveParts.length * terrainFactor);
  const withoutCarryNumMove = Math.ceil(withoutCarry.length * terrainFactor);
  console.log(`Total: ${nonMoveNumMove}, Without carrying: ${withoutCarryNumMove}`);
  return nonMoveNumMove;
}

export function marketOrders(resourceType: ResourceConstant = RESOURCE_HYDROGEN): void {
  // Retrieve all active market orders
  const allOrders = Game.market.getAllOrders();

  // Filter for orders involving hydrogen
  const hydrogenOrders = allOrders.filter(order => order.resourceType === resourceType);

  // Separate buy and sell orders
  const buyOrders = hydrogenOrders.filter(order => order.type === ORDER_BUY);
  const sellOrders = hydrogenOrders.filter(order => order.type === ORDER_SELL);

  // Sort
  buyOrders.sort((a, b) => a.price - b.price);
  sellOrders.sort((a, b) => a.price - b.price);

  // Find lowest, p50, and average prices for each
  const buyPrices = buyOrders.map(order => order.price);
  const buyAmount = buyOrders.map(order => order.amount * order.price);
  const summedBuyAmount = _.sum(buyAmount);
  const totalBuyAmount = _.reduce(buyOrders, (sum, order) => sum + order.amount, 0);

  const lowestBuy = buyPrices[0];
  const p50Buy = buyOrders[Math.floor(buyOrders.length / 2)].price;
  const avgBuy = summedBuyAmount / totalBuyAmount;
  const maxBuy = buyPrices[buyPrices.length - 1];

  const sellPrices = sellOrders.map(order => order.price);
  const sellAmount = sellOrders.map(order => order.amount * order.price);
  const summedSellAmount = _.sum(sellAmount);
  const totalSellAmount = _.reduce(sellOrders, (sum, order) => sum + order.amount, 0);

  const lowestSell = sellPrices[0];
  const p50Sell = sellOrders[Math.floor(sellOrders.length / 2)].price;
  const avgSell = summedSellAmount / totalSellAmount;

  console.log(`Buy Orders for ${resourceType}`);
  console.log(`  Lowest: ${lowestBuy}`);
  console.log(`  P50: ${p50Buy}`);
  console.log(`  Average: ${avgBuy}`);
  console.log(`  Max: ${maxBuy}`);
  console.log(`Sell Orders for ${resourceType}`);
  console.log(`  Lowest: ${lowestSell}`);
  console.log(`  P50: ${p50Sell}`);
  console.log(`  Average: ${avgSell}`);

  // Log the results
  // console.log(`Buy Orders for ${resourceType}`, JSON.stringify(buyOrders, null, 2));
  // console.log(`Sell Orders for ${resourceType}`, JSON.stringify(sellOrders, null, 2));
}

export function myOrders(): void {
  const orders = Game.market.orders;
  console.log(`My orders: ${JSON.stringify(orders, null, 2)}`);
}

export function findHighestBuyOrder(
  resourceType: ResourceConstant,
  amount: number,
  maxEnergy?: number,
  energyCost = 35
): FoundBuyOrder | null {
  const bestOrder = findHighestBuyOrderImpl(resourceType, amount, maxEnergy, energyCost);
  console.log(`Best order: ${JSON.stringify(bestOrder, null, 2)}`);
  return bestOrder;
}

export function findLowestSellOrder(resourceType: ResourceConstant, amount: number): FoundSellOrder | null {
  const bestOrder = findLowestSellOrderImpl(resourceType, amount);
  console.log(`Best order: ${JSON.stringify(bestOrder, null, 2)}`);
  return bestOrder;
}

export function cancelAllOrders(): void {
  for (const orderId in Game.market.orders) {
    const res = Game.market.cancelOrder(orderId);
    console.log(`Cancel order ${orderId}: ${res}`);
  }
}
export function cancelBuyOrders(): void {
  for (const orderId in Game.market.orders) {
    const order = Game.market.orders[orderId];
    if (order.type === ORDER_BUY) {
      const res = Game.market.cancelOrder(orderId);
      console.log(`Cancel order ${orderId}: ${res}`);
    }
  }
}
