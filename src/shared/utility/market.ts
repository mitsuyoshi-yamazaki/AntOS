export const Market = {
  highestPriceBuyOrder(resourceType: ResourceConstant): Order | null {
    const orders = Game.market.getAllOrders({ resourceType, type: ORDER_BUY }).filter(order => order.remainingAmount > 0)
    orders.sort((lhs, rhs) => rhs.price - lhs.price)

    return orders[0] ?? null
  },
}
