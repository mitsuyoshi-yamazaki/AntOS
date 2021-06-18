/* eslint-disable */
import { ErrorMapper } from "utils/ErrorMapper"

import { Empire } from "classes/empire"
import * as Initializer from "classes/init"
import { leveled_colored_text } from './linted/utility'

Initializer.init()
const initializing_message = `Initializer.init() v${Game.version} at ${Game.time}`
console.log(leveled_colored_text(initializing_message, 'warn'))

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  if (Memory.debug.cpu.show_usage) {
    console.log(`\n\n--------------\n\n`)
  }

  ErrorMapper.wrapLoop(() => {
    Initializer.tick()
  }, `Initializer.tick`)()

  ErrorMapper.wrapLoop(() => {
    const owned_controllers: StructureController[] = []

    for (const room_name in Game.rooms) {
      const room = Game.rooms[room_name]
      if (!room || !room.controller || !room.controller.my) {
        continue
      }

      if (room.memory && room.memory.is_gcl_farm) {
        continue
      }

      owned_controllers.push(room.controller)
    }

    const empire = new Empire(Game.user.name, owned_controllers)

    empire.run()
  }, `empire.run`)()

  if ((Game.time % 29) == 3) {
    ErrorMapper.wrapLoop(() => {
      for (const creep_name in Game.creeps) {
        const creep = Game.creeps[creep_name]

        if ((creep.ticksToLive || 0) < 1450) {
          continue
        }

        creep.notifyWhenAttacked(!(!creep.memory.should_notify_attack))

        if (creep.squad || creep.spawning) {
          continue
        }

        console.log(`Creep missing squad ${creep.name}, squad name: ${creep.memory.squad_name}, ${creep.memory.status}, ${creep.memory.type}, at ${creep.pos}`)
        creep.say(`NO SQD`)

        // creep.memory.let_thy_die = true
        // creep.memory.squad_name = 'worker771957135'  // W48N11
      }
      console.log(`Main creeps GC at ${Game.time}`)
    }, `Creeps.gc`)()
  }

  if ((Game.time % 997) == 17) {
    ErrorMapper.wrapLoop(() => {
      for (const squad_name in Memory.squads) {
        const squad_memory = Memory.squads[squad_name]
        const room = Game.rooms[squad_memory.owner_name]

        if (room && room.controller && room.controller.my) {
          continue
        }

        delete Memory.squads[squad_name]
      }
      console.log(`Main squads GC at ${Game.time}`)
    }, `Squads.gc`)()
  }

  const test_send_resources = Memory.debug.test_send_resources
  if (test_send_resources) {
    Memory.debug.test_send_resources = false
  }

  if ((Game.time % 197) == 100) {
    ErrorMapper.wrapLoop(() => {
      // if ((Game.time % 7) == 0) {  // @fixme:
        trade()
        console.log(`Main.trade at ${Game.time}`)
    }, `Trade`)()
  }

  // ErrorMapper.wrapLoop(() => {
  //   for (const creep_name in Game.creeps) {
  //     const creep = Game.creeps[creep_name]

  //     if (!creep.memory.debug) {
  //       continue
  //     }

  //     creep.say(creep.memory.status)
  //   }
  // }, `Creep.debug`)()

  if (Memory.debug.show_costmatrix) {
    const room_name: string = Memory.debug.show_costmatrix

    ErrorMapper.wrapLoop(() => {
      const room = Game.rooms[room_name]

      if (!room) {
        console.log(`Show costmatrix no room ${room_name} found`)
      }
      else {
        const cost_matrix: CostMatrix | undefined = room.cost_matrix()
        console.log(`Showing costmatrix ${room_name}`)

        if (cost_matrix) {
          cost_matrix.show(room)
        }
        else {
          room.visual.text(`NO costmatrix for ${room_name}`, 25, 25, {
            color: '#ff0000',
            align: 'center',
            font: '12px',
            opacity: 0.8,
          })
        }
      }
    }, `Show costmatrix ${room_name}`)()
  }

  if ((Game.time % 47) == 13) {
    ErrorMapper.wrapLoop(() => {
      const credit = Game.market.credits
      let message: string | undefined

      if (credit < 380000) {
        const credit_message = `Credit ${credit}`
        message = message ? (message + credit_message) : credit_message
      }

      if (message) {
        message = '[WARNING] ' + message

        console.log(message)
        Game.notify(message)
      }
    }, `Notify credit | cpu`)()
  }

  // console.log(`move()/Creeps: ${move_called}/${Object.keys(Game.creeps).length}`)

  const all_cpu = Math.ceil(Game.cpu.getUsed())
  Memory.cpu_usages.push(all_cpu)

  if ((all_cpu > Memory.debug.cpu.stop_threshold) && Memory.debug.cpu.show_usage) {
    Memory.debug.cpu.show_usage = false
  }
}, `Main`)

function trade():void {
  if (Memory.trading.stop) {
    console.log(`STOP TRADING ${Memory.trading.stop}`)
    return
  }

  const credit_amount = Game.market.credits
  const rooms: Room[] = []

  const o_rooms: Room[] = ['W43S5', 'W55S23'].map((room_name) => {
    return Game.rooms[room_name]
  }).filter((r) => {
    return !(!r)
  })

  const u_rooms: Room[] = ['W45S27'].map((room_name) => {
    return Game.rooms[room_name]
  }).filter((r) => {
    return !(!r)
  })

  const power_rooms: Room[] = ['W55S13'].map((room_name) => {
    return Game.rooms[room_name]
  }).filter((r) => {
    return !(!r)
  })

  for (const name in Game.rooms) {
    const room = Game.rooms[name]
    if (!room || !room.controller || !room.controller.my || !room.terminal) {
      continue
    }
    if (room.memory && room.memory.is_gcl_farm) {
      continue
    }

    rooms.push(room)
  }

  sellResource({
    resource_type: RESOURCE_HYDROGEN,
    price: 0.200,
    rooms,
  })

  sellResource({
    resource_type: RESOURCE_KEANIUM,
    price: 0.060,
    rooms,
  })

  sellResource({
    resource_type: RESOURCE_CATALYST,
    price: 0.250,
    rooms,
  })

  // sellResource({
  //   resource_type: RESOURCE_UTRIUM,
  //   price: 0.161,
  //   rooms,
  // })

  // buyResource({
  //   resource_type: RESOURCE_KEANIUM,
  //   price: 0.01,
  //   rooms,
  // }, credit_amount)

  buyResource({
    resource_type: RESOURCE_ZYNTHIUM,
    price: 0.01,
    rooms,
  }, credit_amount)

  buyResource({
    resource_type: RESOURCE_UTRIUM,
    price: 0.04,
    rooms: u_rooms,
  }, credit_amount)

  // buyResource({
  //   resource_type: RESOURCE_LEMERGIUM,
  //   price: 0.01,
  //   rooms,
  // }, credit_amount)

  buyResource({
    resource_type: RESOURCE_CATALYST,
    price: 0.03,
    rooms,
  }, credit_amount)

  buyResource({
    resource_type: RESOURCE_POWER,
    price: 0.1,
    rooms: power_rooms,
  }, credit_amount)

  // buyResource({
  //   resource_type: RESOURCE_OXYGEN,
  //   price: 0.02,
  //   rooms: (o_rooms.length > 0) ? o_rooms : rooms,
  // }, credit_amount)

  // buyResource({
  //   resource_type: RESOURCE_HYDROGEN,
  //   price: 0.02,
  //   rooms,
  // }, credit_amount)

  // //
  // const a_room = Game.rooms['W39S9']
  // a_room.find(FIND_STRUCTURES, {
  //   filter: (structure) => {
  //     return (structure.structureType == STRUCTURE_EXTENSION) && !structure.my
  //   }
  // }).forEach((extension) => {
  //   extension.destroy()
  // })
}

// type OrderTypeConstant = ORDER_SELL | ORDER_BUY  // not working

/**
 * @param resource_type
 * @param order_type If you want to BUY something, it seeks SELL order
 */
interface TradeResourceOptions {
  resource_type: ResourceConstant,
  price: number,
  rooms: Room[],
  storage_min_amount?: number,
}

// Sell
function sellResource(opt: TradeResourceOptions): void {

  const orders = buyOrders(opt.resource_type, opt.price)
  const order = orders[0]

  // console.log(`${opt.resource_type} sellResource ${orders.map(o=>[o.price, o.amount])}`)

  if (order) {
    const trader: Room | undefined = sellerRoom(opt.rooms, opt.resource_type, order.amount, opt)
    let message: string

    if (trader && trader.terminal) {
      const buyer_resource_amount = Math.min((trader.terminal.store[opt.resource_type] || 0), order.amount)


      // const trade_result = "simulate"
      const trade_result = Game.market.deal(order.id, buyer_resource_amount, trader.name)
      message = `SELL ${opt.resource_type}: ${trade_result}, [${order.price} * ${buyer_resource_amount} (+${order.price * buyer_resource_amount})] ${trader.name} orders: ${orders.map(o=>`\n${o.price} * ${o.amount}`)}`

      const index = opt.rooms.indexOf(trader)

      if (index >= 0) {
        opt.rooms.splice(index, 1)
      }

      console.log(message)
      // Game.notify(message)
    }
    else {
      message = `[NO Trader] SELL ${opt.resource_type}, ${order.id} ${order.price} * ${order.amount} orders: ${orders.map(o=>`\n${o.price} * ${o.amount}`)}`

      const detail: any[] = opt.rooms.map((room) => {
        if (!room.terminal || !room.storage) {
          return `\n${room.name} no storage`
        }
        return `\n${room.name}: t${room.terminal.store[opt.resource_type] || 0}, s${room.storage.store[opt.resource_type] || 0}`
      })
      message += `${detail}`
    }

    console.log(message)
    // Game.notify(message)
  }
  else {
    // console.log(`No ${opt.resource_type} buy orders (${opt.price})`)
  }
}

function sellerRoom(rooms: Room[], resource_type: ResourceConstant, order_amount: number, opts?: {storage_min_amount?: number}): Room | undefined {
  opts = opts || {}
  const min = opts.storage_min_amount || 40000

  return rooms.filter((room) => {
    if (!room || !room.terminal || !room.storage) {
      return false
    }

    const storage_amount = (room.storage.store[resource_type] || 0)
    if (storage_amount < min) {
      return false
    }

    if (room.terminal.cooldown > 0) {
      return false
    }

    const terminal_amount = (room.terminal.store[resource_type] || 0)
    if (terminal_amount > order_amount) {
      return true
    }
    if (terminal_amount >= 10000) {
      return true
    }
    return false
  })[0]
}

function buyOrders(resource_type: ResourceConstant, price: number): Order[] {
  return Game.buyOrders(resource_type, price)
}

// -- Buy
function buyResource(opt: TradeResourceOptions, credit_amount: number): void {
  if (credit_amount < 380000) {
    const message = `main.tradeResource lack of credit ${credit_amount}`
    // console.log(message)
    // Game.notify(message)
    return
  }

  const orders = sellOrders(opt.resource_type, opt.price)
  const order = orders[0]

  // console.log(`${opt.resource_type} sellOrders ${orders.map(o=>[o.price, o.amount])}`)

  if (order) {
    const trader: Room | undefined = buyerRoom(opt.rooms, order.amount)
    let message: string

    if (trader && trader.terminal) {
      const buy_amount = Math.min(order.amount, 20000)

      // const trade_result = "simulate"
      const trade_result = Game.market.deal(order.id, buy_amount, trader.name)
      message = `BUY ${opt.resource_type}: ${trade_result}, [${order.price} * ${buy_amount} (-${order.price * buy_amount})] ${trader.name} orders: ${orders.map(o=>`\n${o.price} * ${o.amount}`)}`

      const index = opt.rooms.indexOf(trader)

      if (index >= 0) {
        opt.rooms.splice(index, 1)
      }

      console.log(message)
      // Game.notify(message)
    }
    else {
      message = `[NO Trader] BUY ${opt.resource_type}, ${order.id} ${order.price} * ${order.amount} orders: ${orders.map(o=>`\n${o.price} * ${o.amount}`)}`
      console.log(message)
      // Game.notify(message)
    }
  }
  else {
    // console.log(`No ${opt.resource_type} sell orders (${opt.price})`)
  }
}

function buyerRoom(rooms: Room[], order_amount: number): Room | undefined {
  return rooms.filter((room) => {
    if (!room || !room.terminal || !room.storage) {
      return false
    }

    const storage_amount = _.sum(room.storage.store)
    if (storage_amount > (room.storage.storeCapacity * 0.8)) {
      return false
    }

    if (room.terminal.cooldown > 0) {
      return false
    }

    const terminal_amount = _.sum(room.terminal.store)
    if ((terminal_amount + order_amount) < (room.terminal.storeCapacity * 0.9)) {
      return true
    }
    return false
  })[0]
}


function sellOrders(resource_type: ResourceConstant, price: number): Order[] {
  return Game.sellOrders(resource_type, price)
}

/**
 * @todo:
 * Strategy:
   * Start power processing in E15N35 sector
 * CPU Clinic:
   * cache carrier path for remote harvester
   * findxxx() costs CPU?
   * balancer
 * Storage Balancing:
   * Not store tire1 & 2 compounds in terminal except it's reaction_outputs
   * Sell raw minerals from rooms those have no enough space in the storage
 * Automation:
   * auto remote harvester
   * auto mineral harvester
 * Problem Solver
   * allow code to store info that they think important: emergence robo speak
 * GCL farm:
   * new layout for more upgraders
 * Claim & Layout:
   * check layout logic when claiming a new room
   * rotate room layout
   * little sub layout that only conatins extensions
 * Unclaim:
   * make it semi-automated
     * send all resources (Region.sendResourcesTo())
     * remove region memory // can be manual
 * Others:
   * what's remote_attacker?
   * show invading info in Game.info()
   * 500k tower minimum storage fill if rcl < 8
   * minimum rampart hits
   * notify portal
   * ignore excluded squad spawn on colony region
   * attack & ranged heal itself?
   * cancel spawning attacker if the invader is eliminated within 10 ticks
 */

/**
 * 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 53 59 61 67 71 73 79 83 89 97 101 103 107 109 113 127 131 137 139 149 151 157 163 167 173 179 181 191 193 197 199 211 223 227 229 233 239 241 251 257 263 269 271 277 281 283 293 307 311 313 317 331 337 347 349 353 359 367 373 379 383 389 397 401 409 419 421 431 433 439 443 449 457 461 463 467 479 487 491 499 503 509 521 523 541 547 557 563 569 571 577 587 593 599 601 607 613 617 619 631 641 643 647 653 659 661 673 677 683 691 701 709 719 727 733 739 743 751 757 761 769 773 787 797 809 811 821 823 827 829 839 853 857 859 863 877 881 883 887 907 911 919 929 937 941 947 953 967 971 977 983 991 997
 * 1511 2099 4099 10009
 */
