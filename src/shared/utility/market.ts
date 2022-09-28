import { coloredResourceType, shortenedNumber } from "./console_utility"
import { ConsoleUtility } from "./console_utility/console_utility"
import { Result } from "./result"
import { RoomName } from "./room_name_types"

export const Market = {
  highestPriceBuyOrder(resourceType: ResourceConstant): Order | null {
    const orders = Game.market.getAllOrders({ resourceType, type: ORDER_BUY }).filter(order => order.remainingAmount > 0)
    orders.sort((lhs, rhs) => rhs.price - lhs.price)

    return orders[0] ?? null
  },

  sell(resourceType: ResourceConstant, roomName: RoomName, maxAmount: number, options?: {minimumPrice?: number}): Result<string, string> {
    const highestPriceOrder = Market.highestPriceBuyOrder(resourceType)
    if (highestPriceOrder == null) {
      return Result.Failed("no buy orders")
    }
    if (options?.minimumPrice != null && highestPriceOrder.price < options.minimumPrice) {
      return Result.Failed(`buy price too low ${highestPriceOrder.price} < ${options.minimumPrice}`)
    }

    const sellAmount = Math.min(maxAmount, highestPriceOrder.remainingAmount)
    if (sellAmount <= 0) {
      return Result.Failed(`too small sell amount ${sellAmount} (order ID: ${highestPriceOrder.id}, remaining: ${highestPriceOrder.remainingAmount}, ${coloredResourceType(resourceType)}, max amount : ${maxAmount} in ${ConsoleUtility.roomLink(roomName)})`)
    }

    const dealResult = Game.market.deal(highestPriceOrder.id, sellAmount, roomName)

    switch (dealResult) {
    case OK:
      return Result.Succeeded(`${sellAmount} ${coloredResourceType(resourceType)} sold for ${ConsoleUtility.colored(shortenedNumber(Math.floor(sellAmount * highestPriceOrder.price)), "info")} credit from ${ConsoleUtility.roomLink(roomName)}, order ID: ${highestPriceOrder.id}`)

    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_NOT_OWNER:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    case ERR_TIRED:
    default:
      return Result.Failed(`order failed with ${dealResult} (order ID: ${highestPriceOrder.id}, remaining: ${highestPriceOrder.remainingAmount}, ${coloredResourceType(resourceType)}, max amount: ${maxAmount} in ${ConsoleUtility.roomLink(roomName)})`)
    }
  },
}
