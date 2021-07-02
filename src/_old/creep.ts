import { StructureFilter, room_link } from "../utility"
import { Squad } from "_old/squad/squad"
import { ChargeTarget } from "./room"
import { CreepTaskState } from "game_object_task/creep_task"

export enum CreepStatus {  // @todo: add "meta" info to status and keep it on memory, to not change objectives between ticks
  NONE    = "none",
  HARVEST = "harvest",
  CHARGE  = "charge",
  BUILD   = "build",
  REPAIR  = "repair",
  UPGRADE = "upgrade",
  BREAK   = "break",
  ATTACK  = "attack",
  ESCAPE  = "escape",
  WAITING_FOR_RENEW = "waiting_for_renew",
}

export enum ActionResult {
  IN_PROGRESS = "in_progress",
  DONE        = "done",
}

export enum CreepType {
  CLAIMER           = 'claimer',
  WORKER            = 'worker',
  UPGRADER          = 'upgrader',
  CONTROLLER_KEEPER = 'controller_keeper',
  HARVESTER         = 'harvester',
  CARRIER           = 'carrier',
  CHARGER           = 'charger',
  ATTACKER          = 'attacker',
  RANGED_ATTACKER          = 'ranged_attacker',
  HEALER            = 'healer',
  SCOUT             = 'scout',
  CREEP_PROVIDER    = 'creep_provider',
  TAKE_OVER         = 'take_over',
}

export interface CreepDestroyOption {
  no_move?: boolean
  max_room?: number
}

export interface CreepSearchAndDestroyOption extends CreepDestroyOption {
  // structure_first?: boolean, // not implemented yet: use target_id
  ignore_source_keeper?: boolean  // default: false
  move_while_healing?: boolean    // default: false
  include_non_ownable_structure?: boolean // default: false
}

export interface CreepTransferOption {
  include?: ResourceConstant[]
  exclude?: ResourceConstant[]
}

export interface CreepChargeTargetOption {
  should_fully_charged?: boolean
  additional_container_ids?: string[]
  should_reload_cache?: boolean
}

export interface CreepTransferLinkToStorageOption {
  additional_links?: StructureLink[]  // Additional links that the charger transfer energy to
  has_support_links?: boolean
  transfer_energy?: boolean // Not withdraw from the destination link, but transfer
}

export type WorkerSource = StructureContainer | StructureStorage | StructureTerminal

declare global {
  interface Creep {
    /** @deprecated Old codebase */
    squad: Squad

    /** @deprecated Old codebase */
    initialize(): void

    /** @deprecated Old codebase */
    _boosted: boolean

    /** @deprecated Old codebase */
    boosted(): boolean

    /** @deprecated Old codebase */
    _boost_info: {[index: string]: boolean}

    /** @deprecated Old codebase */
    boost_info(): {[index: string]: boolean}

    /** @deprecated Old codebase */
    _carrying_resources: ResourceConstant[]

    /** @deprecated Old codebase */
    carrying_resources(): ResourceConstant[]

    // Attributes
    /** @deprecated Old codebase */
    hasActiveBodyPart(body_part: BodyPartConstant): boolean

    // General tasks
    /** @deprecated Old codebase */
    moveToRoom(destination_room_name: string): ActionResult

    /** @deprecated Old codebase */
    _moveToRoom(destination_room_name: string): ActionResult

    /** @deprecated Old codebase */
    goToRenew(spawn: StructureSpawn, opts?:{ticks?: number, no_auto_finish?: boolean, withdraw?: boolean}): ActionResult

    /** @deprecated Old codebase */
    find_charge_target(opts?: CreepChargeTargetOption): ChargeTarget | undefined

    /** @deprecated Old codebase */
    transferResources(target: {store: StoreDefinition}, opt?: CreepTransferOption): ScreepsReturnCode

    /** @deprecated Old codebase */
    withdrawResources(target: {store: StoreDefinition}, opt?: CreepTransferOption): ScreepsReturnCode

    /** @deprecated Old codebase */
    dropResources(opt?: CreepTransferOption): ScreepsReturnCode

    /** @deprecated Old codebase */
    dismantleObjects(target_room_name: string, opts?:{include_wall?: boolean, excludes?: StructureConstant[]}): ActionResult

    /** @deprecated Old codebase */
    transferLinkToStorage(link: StructureLink | undefined, pos: {x: number, y: number}, opt?: CreepTransferLinkToStorageOption): void

    // Worker tasks
    /** @deprecated Old codebase */
    work(room: Room, sources: WorkerSource[], opts?: {additional_container_ids?: string[]}): void

    /** @deprecated Old codebase */
    upgrade(source_filter: StructureFilter | undefined): ActionResult

    /** @deprecated Old codebase */
    searchAndDestroyTo(room_name: string, attack_anything: boolean, opt?: CreepSearchAndDestroyOption): ActionResult

    /** @deprecated Old codebase */
    searchAndDestroy(opt?: CreepSearchAndDestroyOption): ActionResult

    /** @deprecated Old codebase */
    healNearbyCreep(): ActionResult

    /** @deprecated Old codebase */
    destroy(target: Creep | Structure, opt?: CreepDestroyOption): ActionResult

    // Controller tasks
    /** @deprecated Old codebase */
    claim(target_room_name: string, should_claim?: boolean): ActionResult

    // Replacing methods
    // _say(message: string, toPublic?: boolean): 0 | -1 | -4
  }

  interface CreepMemory {
    /** task state */
    ts: CreepTaskState | null

    /** last time task executed */
    tt: number

    /** @deprecated Old codebase */
    squad_name: string

    /** @deprecated Old codebase */
    status: CreepStatus

    /** @deprecated Old codebase */
    type: CreepType

    /** @deprecated Old codebase */
    birth_time: number

    /** @deprecated Old codebase */
    should_silent?: boolean

    /** @deprecated Old codebase */
    should_notify_attack: boolean

    /** @deprecated Old codebase */
    let_thy_die: boolean

    /** @deprecated Old codebase */
    debug?: boolean

    /** @deprecated Old codebase */
    stop?: boolean

    /** @deprecated Old codebase */
    destination_room_name?: string

    /** @deprecated Old codebase */
    withdraw_target?: string            // something that has energy

    /** @deprecated Old codebase */
    withdraw_resources_target?: string  // something that has store

    /** @deprecated Old codebase */
    pickup_target?: string

    /** @deprecated Old codebase */
    no_path?: DirectionConstant
  }
}

export let move_called = 0

export function init() {
  // Creep.prototype._say = Creep.prototype.say

  // Creep.prototype.say = function(message: string, toPublic?: boolean): 0 | -1 | -4 {

  //   if (Game.time % 10 == 0) {
  //     console.log(`${this.name} saying "${message}"`)
  //   }

  //   // return this._say(message, toPublic)  // WARNING: recursive call
  //   return OK
  // }

  // Creep.prototype.moveTo = function(x: number, y: number, opts?: MoveToOpts): 0 | -1 | -2 | -4 | -7 | -11 | -12 {
  //   return OK
  // }

  // Creep.prototype.moveTo = function(target: RoomPosition|{pos: RoomPosition}, opts?: MoveToOpts): 0 | -1 | -2 | -4 | -7 | -11 | -12 {
  //   return OK
  // }

  move_called = 0
  // Creep.prototype.move = function(direction: DirectionConstant): CreepMoveReturnCode {
  //   move_called += 1
  //   return OK
  // }

  Creep.prototype.initialize = function() {
    if ((this.memory.status == null) || (this.memory.status == undefined)) {
      this.memory.status = CreepStatus.NONE
    }
  }

  // ---
  Creep.prototype.boosted = function(): boolean {
    if (this._boosted == null) {
      this._boosted = false
      this.boost_info()
    }
    return this._boosted
  }

  Creep.prototype.boost_info = function(): {[index: string]: boolean} {
    if (!this._boost_info) {
      this._boosted = false
      this._boost_info = {}

      for (const body of this.body) {
        if (body.boost) {
          this._boosted = true
          this._boost_info[body.type] = true
        }
      }
    }
    return this._boost_info
  }

  Creep.prototype.carrying_resources = function(): ResourceConstant[] {
    if (!this._carrying_resources) {
      this._carrying_resources = []
      for (const resource_type of Object.keys(this.carry)) {
        if ((this.carry[resource_type as ResourceConstant] || 0) == 0) {
          continue
        }
        this._carrying_resources.push(resource_type as ResourceConstant)
      }
    }
    return this._carrying_resources
  }

  // --- Attributes ---
  Creep.prototype.hasActiveBodyPart = function(body_part: BodyPartConstant): boolean {
    // https://github.com/screeps/engine/blob/551aa41163c45273d706ce238c6b35f379c0149e/src/game/creeps.js#L20-L28
    for(var i = this.body.length-1; i>=0; i--) {
      if (this.body[i].hits <= 0) {
        break
      }
      if (this.body[i].type === body_part) {
        return true
      }
    }
    return false
  }

  // --- General tasks ---
  Creep.prototype._moveToRoom = function(destination_room_name: string): ActionResult {
    this.say(`DEBUGGING`)

    return ActionResult.IN_PROGRESS
  }

  Creep.prototype.moveToRoom = function(destination_room_name: string): ActionResult {
    if (this.room.name == destination_room_name) {
      const index = (Game.time % 3)

      if (this.pos.x == 0) {
        if (this.move([RIGHT, TOP_RIGHT, BOTTOM_RIGHT][index]) == OK) {
          return ActionResult.IN_PROGRESS
        }
      }
      if (this.pos.x == 49) {
        if (this.move([LEFT, TOP_LEFT, BOTTOM_LEFT][index]) == OK) {
          return ActionResult.IN_PROGRESS
        }
      }
      if (this.pos.y == 0) {
        if (this.move([BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT][index]) == OK) {
          return ActionResult.IN_PROGRESS
        }
      }
      if (this.pos.y == 49) {
        if (this.move([TOP, TOP_LEFT, TOP_RIGHT][index]) == OK) {
          return ActionResult.IN_PROGRESS
        }
      }

      this.memory.destination_room_name = undefined
      return ActionResult.DONE
    }

    if (Game.shard.name === "shard3" && destination_room_name === "W48S27" && this.room.name === "W49S27") {
      this.moveTo(49, 22)
      return ActionResult.IN_PROGRESS
    }

    if (this.memory.no_path != null) {
      this.move(this.memory.no_path)

      this.memory.no_path = undefined
      return ActionResult.IN_PROGRESS
    }

    let opt: MoveToOpts = {
      maxRooms: 1,
      reusePath: 10,
      maxOps: 500,
    }

    if (this.room.name == this.memory.destination_room_name) {
      this.memory.destination_room_name = undefined
    }

    if (this.memory.destination_room_name) {
      destination_room_name = this.memory.destination_room_name
    }

    if (Game.shard.name === "shardSeason") {
      if (["W27S26", "W28S26", "W28S25", "W29S25"].includes(this.room.name) === true && destination_room_name === "W23S25") {
        destination_room_name = "W30S25"
      }
    }

    const exit = ((): FindConstant => {
      return this.room.findExitTo(destination_room_name) as FindConstant
    })()
    if (exit < 0) {
      console.log(`Creep.moveToRoom from ${this.room.name} to ${destination_room_name} can't find exit ${exit}, ${this.name}, ${this.pos}`)
      this.say('NOEXIT')
      return ActionResult.IN_PROGRESS
    }

    const closest_exit = this.pos.findClosestByPath(exit)
    if (!closest_exit || (this.moveTo(closest_exit, opt) == ERR_NO_PATH)) { // When too close to source in source keeper's room
      // if (opt) {
      //   this.moveTo(closest_exit, {
      //     costCallback: (room_name: string) => new PathFinder.CostMatrix(), // Reset cached CostMatrix
      //   })
      // }

      // if (this.room.is_keeperroom) {
      //   opt.costCallback = undefined

      //   this.moveTo(closest_exit)
      //   this.say(`NO CCB`)
      //   return ActionResult.IN_PROGRESS
      // }

      this.say(`np${destination_room_name}`)

        // To avoid ERR_NO_PATH on room borders
      if (this.pos.x <= 0) {
        if (this.move(RIGHT) == OK) {
          this.memory.no_path = RIGHT
          return ActionResult.IN_PROGRESS
        }
      }
      if (this.pos.x >= 49) {
        if (this.move(LEFT) == OK) {
          this.memory.no_path = LEFT
          return ActionResult.IN_PROGRESS
        }
      }
      if (this.pos.y <= 0) {
        if (this.move(BOTTOM) == OK) {
          this.memory.no_path = BOTTOM
          return ActionResult.IN_PROGRESS
        }
      }
      if (this.pos.y >= 49) {
        if (this.move(TOP) == OK) {
          this.memory.no_path = TOP
          return ActionResult.IN_PROGRESS
        }
      }
      if (this.room.name == 'W46S42') {
        this.moveTo(new RoomPosition(30, 44, this.room.name), opt)
        return ActionResult.IN_PROGRESS
      }

      if (this.room.name == 'W45S7') {
        this.moveTo(new RoomPosition(36, 22, this.room.name), {maxRooms: 1})
        return ActionResult.IN_PROGRESS
      }

      if (this.room.controller) {
        const result = this.moveTo(this.room.controller, opt)
        this.say(`E${result}`)
      }
      else {
        console.log(`Creep.moveToRoom no path and no room controller ${this.room} ${this.room.controller} ${this.pos}`)
      }
      // this.moveTo(closest_exit, {
      //   // swampCost: 1,
      //   maxOps: 10000,  // @fixme: It INCREASES SPU cost
      // } as MoveToOpts)
    }

    return ActionResult.IN_PROGRESS
  }

  Creep.prototype.goToRenew = function(spawn: StructureSpawn, opts?:{ticks?: number, no_auto_finish?: boolean, withdraw?: boolean}): ActionResult {
    opts = opts || {}
    const ticks = opts.ticks || 1400

    if (!opts.no_auto_finish && ((this.ticksToLive || 0) >= ticks)) {
      this.memory.status = CreepStatus.NONE
      return ActionResult.DONE
    }

    if (this.memory.let_thy_die) {
      console.log(`Creep.goToRenew unexpectedly found let_thy_die is true ${this.name}`)
      return ActionResult.DONE
    }

    this.memory.status = CreepStatus.WAITING_FOR_RENEW
    const move_result = this.moveTo(spawn)
    this.transfer(spawn, RESOURCE_ENERGY)

    if (opts.withdraw && (this.room.storage)) {
      this.withdraw(this.room.storage, RESOURCE_ENERGY)
    }

    if (move_result != OK) {
      this.say(`E${move_result}`)
    }

    return ActionResult.IN_PROGRESS
  }

  Creep.prototype.find_charge_target = function(opts?: CreepChargeTargetOption): ChargeTarget | undefined {
    const options = opts || {}
    const additional_container_ids = options.additional_container_ids || []
    const is_attacked = this.room.attacker_info().attacked
    let structures_needed_to_be_charged: ChargeTarget[]

    if (this.room.structures_needed_to_be_charged) {
      structures_needed_to_be_charged = this.room.structures_needed_to_be_charged
      // console.log(`Creep.find_charge_target has structures_needed_to_be_charged ${this.room.name}`)
    }
    else {
      if (this.room.owned_structures) {
        // console.log(`Creep.find_charge_target create structures_needed_to_be_charged ${this.room.name}`)

        const owned_structures = this.room.owned_structures

        let structures: ChargeTarget[] = []

        structures = structures.concat((owned_structures.get(STRUCTURE_EXTENSION) || []) as StructureExtension[])
        structures = structures.concat((owned_structures.get(STRUCTURE_SPAWN) || []) as StructureSpawn[])
        structures = structures.concat((owned_structures.get(STRUCTURE_TOWER) || []) as StructureTower[])
        structures = structures.concat((owned_structures.get(STRUCTURE_TERMINAL) || []) as StructureTerminal[])
        structures = structures.concat((owned_structures.get(STRUCTURE_LAB) || []) as StructureLab[])
        structures = structures.concat((owned_structures.get(STRUCTURE_POWER_SPAWN) || []) as StructurePowerSpawn[])

        additional_container_ids.forEach((id) => {
          const container = Game.getObjectById(id) as StructureContainer | undefined
          if (container && (container.structureType == STRUCTURE_CONTAINER)) {  // possibly link
            structures.push(container)
          }
        })

        structures_needed_to_be_charged = structures.filter(structure => {
          // if (!structure.isActive()) {
          //   return false
          // }
          if (structure.structureType == STRUCTURE_CONTAINER) {
            if (additional_container_ids.indexOf(structure.id) >= 0) {
              if (structure.store.energy < 1500) {
                return true
              }
              return false
            }
            return false
          }
          if (!(structure as OwnedStructure).my) {
            return false
          }

          if (structure.structureType == STRUCTURE_EXTENSION) {
            return (structure.energy < structure.energyCapacity)
          }
          else if (structure.structureType == STRUCTURE_SPAWN) {
            const capacity = options.should_fully_charged ? structure.energyCapacity : (structure.energyCapacity - 50)
            return structure.energy < capacity
          }
          else if (structure.structureType == STRUCTURE_TOWER) {
            let margin = this.room.attacker_info().attacked ? 100 : 200
            const capacity = options.should_fully_charged ? structure.energyCapacity : (structure.energyCapacity - margin)
            return structure.energy <= capacity
          }
          else if (!is_attacked) {
            if (structure.structureType == STRUCTURE_POWER_SPAWN) {
              return (structure.energy < (structure.energyCapacity * 0.7))
            }
            else if (structure.structureType == STRUCTURE_TERMINAL) {
              // structure.store.energyを変更する際はtransferLinkToStorageも
              if (!structure.room.storage) {
                return false
              }
              const is_rcl8 = !(!structure.room.controller) && structure.room.controller.my && (structure.room.controller.level == 8)

              const energy = 100000//(is_rcl8 && (structure.room.storage.store.energy > 200000)) ? 150000 : 100000
              return (structure.store.energy < energy)
            }
            else if (structure.structureType == STRUCTURE_LAB) {
              return (structure.energy < (structure.energyCapacity - 100))
            }
            // else if (structure.structureType == STRUCTURE_NUKER) {
            //   if (!structure.room.storage || (structure.room.storage.store.energy < 500000)) {
            //     return false
            //   }
            //   return (structure.energy < structure.energyCapacity)
            // }
          }
          return false
        })
      }
      else {
        // console.log(`Creep.find_charge_target unexpectedly no owned_structures ${this.room.name}`)

        structures_needed_to_be_charged = this.room.find(FIND_STRUCTURES, {
          filter: structure => {
            if (structure.structureType == STRUCTURE_CONTAINER) {
              if (additional_container_ids.indexOf(structure.id) >= 0) {
                if (structure.store.energy < 1500) {
                  return true
                }
                return false
              }
              return false
            }
            if (!(structure as OwnedStructure).my) {
              return false
            }

            if (structure.structureType == STRUCTURE_EXTENSION) {
              return (structure.energy < structure.energyCapacity)
            }
            else if (structure.structureType == STRUCTURE_SPAWN) {
              const capacity = options.should_fully_charged ? structure.energyCapacity : (structure.energyCapacity - 50)
              return structure.energy < capacity
            }
            else if (structure.structureType == STRUCTURE_TOWER) {
              let margin = this.room.attacker_info().attacked ? 100 : 200
              const capacity = options.should_fully_charged ? structure.energyCapacity : (structure.energyCapacity - margin)
              return structure.energy <= capacity
            }
            else if (!is_attacked) {
              if (structure.structureType == STRUCTURE_POWER_SPAWN) {
                return (structure.energy < (structure.energyCapacity * 0.7))
              }
              else if (structure.structureType == STRUCTURE_TERMINAL) {
                // structure.store.energyを変更する際はtransferLinkToStorageも
                if (!structure.room.storage) {
                  return false
                }
                const is_rcl8 = !(!structure.room.controller) && structure.room.controller.my && (structure.room.controller.level == 8)

                const energy = 100000//(is_rcl8 && (structure.room.storage.store.energy > 200000)) ? 150000 : 100000
                return (structure.store.energy < energy)
              }
              else if (structure.structureType == STRUCTURE_LAB) {
                return (structure.energy < (structure.energyCapacity - 100))
              }
              // else if (structure.structureType == STRUCTURE_NUKER) {
              //   if (!structure.room.storage || (structure.room.storage.store.energy < 500000)) {
              //     return false
              //   }
              //   return (structure.energy < structure.energyCapacity)
              // }
            }
            return false
          }
        }) as ChargeTarget[]
      }

      if (options.should_reload_cache) {
        this.room.structures_needed_to_be_charged = structures_needed_to_be_charged
      }
    }

    // if (this.room.name == 'E16N37') {
    //   const s = structures_needed_to_be_charged.map(s=>`(${s.pos.x},${s.pos.y})`)
    //   console.log(`HOGE ${s}`)
    // }

    return this.pos.findClosestByPath(structures_needed_to_be_charged) ?? undefined
  }

  Creep.prototype.transferResources = function(target: StructureContainer | StructureStorage | StructureTerminal, opt?: CreepTransferOption): ScreepsReturnCode {
    opt = opt || {}

    if (!target) {
      if ((Game.time % 29) == 3) {
        const message = `Creep.withdrawResources unexpectedly find null target ${this.name} ${this.pos}`
        console.log(message)
        Game.notify(message)
      }
      return ERR_INVALID_ARGS
    }

    if (!this.pos.isNearTo(target)) {
      return ERR_NOT_IN_RANGE
    }

    let return_code: ScreepsReturnCode = ERR_NOT_ENOUGH_RESOURCES
    for (const key of Object.keys(this.carry)) {
      const resource_type = key as ResourceConstant
      if (opt.include) {
        if (opt.include.indexOf(resource_type) < 0) {
          continue
        }
      }
      else if (opt.exclude) {
        if (opt.exclude.indexOf(resource_type) >= 0) {
          continue
        }
      }

      if (this.carry[resource_type] == 0) {
        continue
      }
      return_code = this.transfer(target, resource_type)
      if (return_code != OK) {
        return return_code
      }
    }
    return return_code
  }

  Creep.prototype.withdrawResources = function(target: StructureContainer | StructureStorage | StructureTerminal, opt?: CreepTransferOption): ScreepsReturnCode {
    opt = opt || {}

    if (!target) {
      if ((Game.time % 29) == 3) {
        const message = `Creep.withdrawResources unexpectedly find null target ${this.name} ${this.pos}`
        console.log(message)
        Game.notify(message)
      }
      return ERR_INVALID_ARGS
    }

    if (!this.pos.isNearTo(target)) {
      return ERR_NOT_IN_RANGE
    }

    let return_code: ScreepsReturnCode = ERR_NOT_ENOUGH_RESOURCES
    for (const key of Object.keys(target.store)) {
      const resource_type = key as ResourceConstant
      if (opt.include) {
        if (opt.include.indexOf(resource_type) < 0) {
          continue
        }
      }
      else if (opt.exclude) {
        if (opt.exclude.indexOf(resource_type) >= 0) {
          continue
        }
      }

      if (target.store[resource_type] == 0) {
        continue
      }
      return_code = this.withdraw(target, resource_type)
      if (return_code != OK) {
        return return_code
      }
    }
    return return_code
  }

  Creep.prototype.dropResources = function(opt?: CreepTransferOption): ScreepsReturnCode {
    opt = opt || {}

    let return_code: ScreepsReturnCode = ERR_NOT_ENOUGH_RESOURCES
    for (const key of Object.keys(this.carry)) {
      const resource_type = key as ResourceConstant
      if (opt.include) {
        if (opt.include.indexOf(resource_type) < 0) {
          continue
        }
      }
      else if (opt.exclude) {
        if (opt.exclude.indexOf(resource_type) >= 0) {
          continue
        }
      }

      if (this.carry[resource_type] == 0) {
        continue
      }
      return_code = this.drop(resource_type)
      if (return_code != OK) {
        return return_code
      }
    }
    return return_code
  }

  Creep.prototype.dismantleObjects = function(target_room_name: string, opts?:{include_wall?: boolean, excludes?: StructureConstant[]}): ActionResult {
    opts = opts || {}

    if (this.moveToRoom(target_room_name) != ActionResult.DONE) {
      this.say(target_room_name)
      return ActionResult.IN_PROGRESS
    }

    const memory = (this.memory as {target_id?: string})

    if (memory.target_id) {
      const specified_target = Game.getObjectById(memory.target_id) as Structure | undefined

      if (specified_target && ('structureType' in specified_target)) {
        if (this.pos.isNearTo(specified_target)) {
          this.dismantle(specified_target)
        }
        else {
          this.moveTo(specified_target)
          this.say(`${specified_target.pos.x},${specified_target.pos.y}`)
        }
        return ActionResult.IN_PROGRESS
      }
      else {
        (this.memory as {target_id?: string}).target_id = undefined
      }
    }

    const hostile_structures = this.room.find(FIND_HOSTILE_STRUCTURES)
    const towers = hostile_structures.filter(s=>s.structureType == STRUCTURE_TOWER)

    let target: Structure | null = null

    if (towers.length > 0) {
      target = this.pos.findClosestByPath(towers)
    }
    if (!target) {
      target = this.pos.findClosestByPath(FIND_HOSTILE_SPAWNS)
    }
    if (!target) {
      let excludes: StructureConstant[] = [
        STRUCTURE_CONTROLLER,
        STRUCTURE_KEEPER_LAIR,
        STRUCTURE_POWER_BANK,
      ]

      if (opts.excludes) {
        excludes = excludes.concat(opts.excludes)
      }

      target = this.pos.findClosestByPath(hostile_structures.filter(s=>(excludes.indexOf(s.structureType) < 0)))
    }
    if (!target && opts.include_wall) {
      const walls: StructureConstant[] = [
        STRUCTURE_WALL,
        STRUCTURE_RAMPART,
      ]
      target = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
          return walls.indexOf(structure.structureType) >= 0
        }
      })
    }

    if (target) {
      memory.target_id = target.id

      if (this.pos.isNearTo(target)) {
        this.dismantle(target)
      }
      else {
        this.moveTo(target)
      }

      return ActionResult.IN_PROGRESS
    }
    else {
      this.say('DONE')
      if ((Game.time % 43) == 5) {
        console.log(`No more targets in ${target_room_name}, ${this.name}`)
      }
      return ActionResult.DONE
    }
  }

  Creep.prototype.transferLinkToStorage = function(link: StructureLink | undefined, pos: {x: number, y: number}, opt?: CreepTransferLinkToStorageOption): void {
    opt = opt || {}

    if (!this.room.storage) {
      this.say(`ERR`)
      console.log(`Creep.transferLinkToStorage no storage in ${this.pos}, ${this}`)
      return
    }

    if (this.spawning) {
      return
    }

    if ((this.pos.x != pos.x) || (this.pos.y != pos.y)) {
      const obstacle = this.room.find(FIND_MY_CREEPS, {
        filter: (creep) => {
          return (creep.pos.x == pos.x) && (creep.pos.y == pos.y)
        }
      })[0]

      // console.log(`obstacle: ${obstacle}`)
      if (obstacle) {
        obstacle.moveTo(this)
      }

      const result = this.moveTo(new RoomPosition(pos.x, pos.y, this.room.name), {ignoreCreeps: true})
      if (result != OK) {
        this.say(`E${result}`)
      }
      return
    }

    const carry = this.store.getUsedCapacity()
    const storage = this.room.storage

    // withdraw
    if ((carry == 0) && ((this.ticksToLive || 0) > 2)) {
      let should_withdraw = true

      if (opt.transfer_energy) {
        should_withdraw = false
      }

      if (link && opt.has_support_links) {
        if (((link.energyCapacity * 0.5) < link.energy) && ((Game.time % 3) == 1)) {
          should_withdraw = false
        }
      }

      if (link && (link.energy > 0) && should_withdraw) {
        const withdraw_result = this.withdraw(link, RESOURCE_ENERGY)
        if (withdraw_result == OK) {
          return
        }
        else {
          this.say(`E${withdraw_result}`)
        }
      }
      if (this.room.terminal) {
        for (const resource_type of RESOURCES_ALL) {
          let amount_min = 10000
          let amount_max = 11000

          if (resource_type == RESOURCE_ENERGY) {
            // const is_rcl8 = !(!this.room.controller) && this.room.controller.my && (this.room.controller.level == 8)
            const multiply = 10//(is_rcl8 && (storage.store.energy > 200000)) ? 15 : 10

            amount_min *= multiply
            amount_max = amount_min + 2000
          }
          else if (resources_should_store_in_storage.indexOf(resource_type) >= 0) {
            amount_min = 0
            amount_max = 0
          }

          const amount = (this.room.terminal.store[resource_type] || 0)
          if ((amount < amount_min) && ((storage.store[resource_type] || 0) > 0)) {
            this.withdraw(storage, resource_type)
            return
          }
          else if (amount > amount_max) {
            this.withdraw(this.room.terminal, resource_type)
            return
          }
          else {
            continue
          }
        }

        if (this.room.owned_structures) {
          const nukers = this.room.owned_structures.get(STRUCTURE_NUKER) as StructureNuker[]
          if (nukers) {
            const nuker = nukers[0]

            if (nuker && this.pos.isNearTo(nuker) && (nuker.ghodium < nuker.ghodiumCapacity) && ((this.room.terminal.store[RESOURCE_GHODIUM] || 0) > 0)) {
              this.withdraw(this.room.terminal, RESOURCE_GHODIUM)
              return
            }
          }

          if ((this.room.terminal.store[RESOURCE_POWER] || 0) > 0) {
            const power_spawns = this.room.owned_structures.get(STRUCTURE_POWER_SPAWN) as StructurePowerSpawn[]
            if (power_spawns) {
              const power_spawn = power_spawns[0]

              if (power_spawn && (power_spawn.power == 0) && this.pos.isNearTo(power_spawn)) {
                this.withdraw(this.room.terminal, RESOURCE_POWER)
                return
              }
            }
          }
        }
      }

      this.withdraw(storage, RESOURCE_ENERGY)
      return
    }

    // transfer
    if (carry > 0) {
      if ((carry - this.carry.energy) == 0) {
        // only have energy
        if (opt.transfer_energy) {
          if (link && (link.energy < link.energyCapacity)) {
            if (this.transfer(link, RESOURCE_ENERGY) == OK) {
              return
            }
          }

          const additional_links = (opt.additional_links || [])

          for (const additional_link of additional_links) {
            if (additional_link.energy < additional_link.energyCapacity) {
              if (this.transfer(additional_link, RESOURCE_ENERGY) == OK) {
                return
              }
            }
          }
        }

        const target = this.find_charge_target()
        if (target) {
          const result = this.transfer(target, RESOURCE_ENERGY)
          if (result == OK) {
            return
          }
        }

        if (this.room.owned_structures) {
          const nukers = this.room.owned_structures.get(STRUCTURE_NUKER) as StructureNuker[]
          if (nukers) {
            const nuker = nukers[0]

            if (nuker && this.pos.isNearTo(nuker) && (nuker.energy < nuker.energyCapacity)) {
              this.transfer(nuker, RESOURCE_ENERGY)
              return
            }
          }

          const power_spawns = this.room.owned_structures.get(STRUCTURE_POWER_SPAWN) as StructurePowerSpawn[]
          if (power_spawns) {
            const power_spawn = power_spawns[0]

            if (power_spawn && this.pos.isNearTo(power_spawn) && (power_spawn.energy < (power_spawn.energyCapacity * 0.7))) {
              this.transfer(power_spawn, RESOURCE_ENERGY)
              return
            }
          }
        }

        const result = this.transfer(storage, RESOURCE_ENERGY)
        if (result == ERR_FULL) {
          if (this.room.terminal) {
            this.transfer(this.room.terminal, RESOURCE_ENERGY)
          }
        }
      }
      else {
        if (this.room.owned_structures) {
          if (((this.carry[RESOURCE_GHODIUM] || 0) > 0)) {
            const nukers = this.room.owned_structures.get(STRUCTURE_NUKER) as StructureNuker[]
            if (nukers) {
              const nuker = nukers[0]

              if (nuker && this.pos.isNearTo(nuker) && (nuker.ghodium < nuker.ghodiumCapacity)) {
                this.transfer(nuker, RESOURCE_GHODIUM)
                return
              }
            }
          }

          if (((this.carry[RESOURCE_POWER] || 0) > 0)) {
            const power_spawns = this.room.owned_structures.get(STRUCTURE_POWER_SPAWN) as StructurePowerSpawn[]
            if (power_spawns) {
              const power_spawn = power_spawns[0]

              if (power_spawn && this.pos.isNearTo(power_spawn) && (power_spawn.power == 0)) {
                this.transfer(power_spawn, RESOURCE_POWER)
                return
              }
            }
          }
        }

        const carrying_resource_type = this.carrying_resources()[0]

        if (this.room.terminal && carrying_resource_type) {
          if (resources_should_store_in_storage.indexOf(carrying_resource_type) >= 0) {
            this.transferResources(storage)
          }
          else {
            const amount = this.room.terminal.store[this.carrying_resources()[0]] || 0

            if (amount < 10000) {
              this.transferResources(this.room.terminal)
            }
            else {
              this.transferResources(storage)
            }
          }
        }
        else {
          this.transferResources(storage)
        }
      }
    }
  }


  // --- Worker tasks ---
  /**
   * source_filter: Filter structure that creep can withdrow from it
   */
  Creep.prototype.upgrade = function(source_filter: StructureFilter | undefined): ActionResult {
    if (!this.room.controller || !this.room.controller.my) {
      console.log(`Creep.upgrade the room is not owned ${this.room.controller}, ${this.name}`)
      return ActionResult.DONE
    }

    const upgrade_result = this.upgradeController(this.room.controller)

    if (([CreepStatus.HARVEST, CreepStatus.UPGRADE].indexOf(this.memory.status) < 0) || (this.carry.energy == 0)) {
      this.memory.status = CreepStatus.HARVEST
    }

    let is_target_for_upgrader = false

    if (this.carry.energy < (this.carryCapacity * 0.7)) {
      const target = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: source_filter
      })

      if (!target) {
        this.say('NO Src')
      }
      else {
        if (this.pos.isNearTo(target)) {
          const withdraw_result = this.withdraw(target, RESOURCE_ENERGY)

          if ((withdraw_result != OK) && this.memory.stop) {
            this.memory.stop = false
          }
          if ((withdraw_result == OK) && (target.structureType != STRUCTURE_STORAGE)) {
            is_target_for_upgrader = true
          }
        }
        else {
          this.moveTo(target)
        }
      }
    }
    else if (!this.memory.stop && (upgrade_result != OK)) {
      const move_to_opts: MoveToOpts = {
        maxRooms: 1,
      }

      if (this.room.name == 'W45S27') {
        move_to_opts.range = 3
      }

      this.moveTo(this.room.controller, move_to_opts)
    }

    if ((this.room.name == 'W45S27') && !this.memory.stop) {
      const x = 40
      const y = 35

      if ((this.pos.x != x) || (this.pos.y != y)) {
        const obstacle = this.room.find(FIND_MY_CREEPS, {
          filter: (creep) => {
            return (creep.pos.x == x) && (creep.pos.y == y)
          }
        })[0]

        // console.log(`obstacle: ${obstacle}`)
        if (obstacle) {
          obstacle.moveTo(this)
        }

        const result = this.moveTo(new RoomPosition(x, y, this.room.name), {ignoreCreeps: true})
        if (result != OK) {
          this.say(`E${result}`)
        }
      }
    }

    if (upgrade_result == OK) {
      if (is_target_for_upgrader) {
        this.memory.stop = true
      }
    }
    else {
      this.say(`E${upgrade_result}`)

      if (this.memory.stop) {
        this.memory.stop = false
      }
    }

    return ActionResult.IN_PROGRESS
  }

  // --- Work ---
  Creep.prototype.work = function(room: Room, sources: WorkerSource[], opts?: {additional_container_ids?: string[]}): void {
    opts = opts || {}

    if (!room) {
      console.log(`Creep.work room not specified ${this.name}`)
    }

    let move_to_opt: MoveToOpts = {
      maxRooms: 1,
      reusePath: 2,
      maxOps: 500,
      // visualizePathStyle: {
      //   fill: 'transparent',
      //   stroke: '#c0c000',
      //   lineStyle: 'dashed',
      //   opacity: 0.4
      // }
    }

    const carry = this.store.getUsedCapacity()

    if ((carry > this.carry.energy) && this.room.storage) {
      if (this.pos.isNearTo(this.room.storage)) {
        this.transferResources(this.room.storage)
      }
      else {
        this.moveTo(this.room.storage, move_to_opt)
        return
      }
    }

    let debug_say = false

    // if (this.room.name == 'W53S15') {
    //   debug_say = true
    // }

    if ((this.memory.status == CreepStatus.NONE) || (this.carry.energy == 0)) {
      this.memory.status = CreepStatus.HARVEST

      if (debug_say) {
        this.say('N2H')
      }
    }

    if ((this.memory.type == CreepType.CARRIER) && ((this.memory.status == CreepStatus.BUILD) || (this.memory.status == CreepStatus.UPGRADE))) {
      this.memory.status = CreepStatus.CHARGE
      if (debug_say) {
        this.say('B2C-1')
      }
    }

    let charge_target: ChargeTarget | undefined
    let find_charge_target = false

    // Harvest
    if (this.memory.status == CreepStatus.HARVEST) {
      if (this.carry.energy == this.carryCapacity) {
        this.memory.status = CreepStatus.CHARGE
        if (debug_say) {
          this.say('H2C')
        }

        const should_split_charger_and_upgrader = false//(this.room.attacker_info().attacked == false) && (['W43N5', 'W47N5', 'W47S6'].indexOf(this.room.name) < 0)

        if (should_split_charger_and_upgrader) { // @fixme: temp code
          let number = 0

          for (const creep_name in Game.creeps) {
            const creep = Game.creeps[creep_name]

            if ((creep.room.name == this.room.name) && (creep.memory.type == CreepType.WORKER)) {
              if (creep.memory.status == CreepStatus.CHARGE) {
                number += 1
              }
            }
          }

          if (number > 3) {
            this.memory.status = CreepStatus.BUILD
            if (debug_say) {
              this.say('C2B-1')
            }
          }
        }
      }
      else {
        if ((this.room.controller && this.room.controller.my && (!this.room.storage || !this.room.storage.my || (this.room.name == 'E17S4')))) {
          const opt = {
            filter: (resource: Resource) => {
              return (resource.resourceType == RESOURCE_ENERGY) && (resource.amount > 30)
            }
          }

          const drop = this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, opt) as Resource | undefined  // , 8

          if (drop) {
            const range = this.pos.getRangeTo(drop)

            if (range <= 1) {
              this.pickup(drop)
              return
            }
            else {
              this.moveTo(drop, move_to_opt)
              return
            }
          }

          // else {
          //   const container = this.pos.findInRange(FIND_STRUCTURES, 5, {
          //     filter: (structure: AnyStructure) => {
          //       return (structure.structureType == STRUCTURE_CONTAINER) && (structure.store.energy > 0)
          //     }
          //   })[0]

          //   if (container) {
          //     if (this.pos.isNearTo(container)) {
          //       this.withdraw(container, RESOURCE_ENERGY)
          //     }
          //     else {
          //       if (carry > (this.carryCapacity * 0.7)) {
          //         this.memory.status = CreepStatus.CHARGE
          //       }
          //       else {
          //         this.moveTo(container, move_to_opt)
          //       }
          //     }
          //   }
          // }
        }

        if ((sources.length > 0)) {
          const source = ((sources.length == 1) && (sources[0].store.energy > 0)) ? sources[0] : this.pos.findClosestByPath(sources, {
            filter: (s: WorkerSource) => {
              if (s.store.energy == 0) {
                return false
              }
              return true
            }
          })
          if (source) {
            if (this.pos.isNearTo(source)) {
              this.withdraw(source, RESOURCE_ENERGY)
              return
            }
            else {
              if (carry > (this.carryCapacity * 0.7)) {
                this.memory.status = CreepStatus.CHARGE
              }
              else {
                this.moveTo(source, move_to_opt)
              }
              return
            }
          }
        }

        const target = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE)

        if (target) {
          if (this.pos.isNearTo(target)) {
            this.harvest(target)
          }
          else {
            if (carry > (this.carryCapacity * 0.7)) {
              this.memory.status = CreepStatus.CHARGE
            }
            else {
              this.moveTo(target, move_to_opt)
            }
            return
          }
        }
        else {
          const target = this.pos.findClosestByPath(FIND_SOURCES)
          if (target && this.pos.isNearTo(target)) {
            this.harvest(target)
          }
          else {
            if (carry > (this.carryCapacity * 0.7)) {
              this.memory.status = CreepStatus.CHARGE
            }
            else if (target) {
              this.moveTo(target, move_to_opt)
            }
            return
          }
        }
      }
    }

    // Charge
    if (this.memory.status == CreepStatus.CHARGE) {

      const target = this.find_charge_target({should_reload_cache: true, ...opts})
      charge_target = target
      find_charge_target = true

      if (!target) {
        if (this.memory.type != CreepType.CARRIER) {
          this.memory.status = CreepStatus.BUILD
          if (debug_say) {
            this.say('C2B-2')
          }
        }
      }
      else if (this.carry.energy == 0) {
        this.memory.status = CreepStatus.HARVEST
        if (debug_say) {
          this.say('C2H-1')
        }
      }
      else {
        if (debug_say) {
          this.say(`${target.pos.x},${target.pos.y}`) // @fixme: targetを保存すれば良さそう
        }
        if (this.pos.isNearTo(target)) {
          const transfer_result = this.transfer(target, RESOURCE_ENERGY)
          if (transfer_result != OK) {
            this.say(`E${transfer_result}`)
          }
        }
        else {
          this.moveTo(target, move_to_opt)
        }
        return
      }
    }

    // Build
    if (this.memory.status == CreepStatus.BUILD) {
      if (this.room.attacker_info().attacked && ((this.memory.birth_time % 2) == 0)) {
        this.memory.status = CreepStatus.CHARGE
        return
      }

      if (this.room.controller && this.room.controller.my && (this.room.controller.ticksToDowngrade < 3000)) {
        this.memory.status = CreepStatus.UPGRADE
        if (debug_say) {
          this.say('B2U-1')
        }
      }
    }

    if (this.memory.status == CreepStatus.BUILD) {

      let should_upgrade = true
      if (['dummy'].indexOf(this.room.name) >= 0) {
        let number = 0

        for (const creep_name in Game.creeps) {
          const creep = Game.creeps[creep_name]

          if ((creep.room.name == this.room.name) && (creep.memory.type == CreepType.WORKER)) {
            if (creep.memory.status == CreepStatus.UPGRADE) {
              number += 1
            }
          }
        }

        if (number > 0) {
          should_upgrade = false
        }
        if (this.room.storage && (this.room.storage.store.energy > 500000)) {
          should_upgrade = true
        }
      }

      if (this.room.controller && (this.room.controller.level >= 8)) {
        should_upgrade = false
      }


      // if (this.room.name == 'W43N5') {
      //   should_upgrade = false
      // }

      if ((!this.room.construction_sites || (this.room.construction_sites.length == 0))) {
        if (should_upgrade) {
          this.memory.status = CreepStatus.UPGRADE
          if (debug_say) {
            this.say('B2U-2')
          }
        }
        else {
          this.memory.status = CreepStatus.HARVEST
          if (debug_say) {
            this.say('B2H-1')
          }

          if (this.room.storage) {
            this.transfer(this.room.storage, RESOURCE_ENERGY)

            return
          }
        }
      }
      else if (this.carry.energy == 0) {
        this.memory.status = CreepStatus.HARVEST
        if (debug_say) {
          this.say('B2H-2')
        }

      }
      else {
        let target = this.pos.findClosestByRange(this.room.construction_sites)

        if (target) {
          this.build(target)
          this.moveTo(target, move_to_opt)
          return
        }
        else {
          this.say(`ERR`)
          console.log(`Creep.work unexpectedly no construction site target ${this.room.construction_sites} ${this.name} ${this.pos}`)
        }
      }
    }

    // Upgrade
    if (this.memory.status == CreepStatus.UPGRADE) {
      if (this.room.attacker_info().attacked) {
        this.memory.status = CreepStatus.CHARGE
        this.say('U2C-1')
      }
    }

    if (this.memory.status == CreepStatus.UPGRADE) {
      if (this.carry.energy == 0) {
        this.memory.status = CreepStatus.HARVEST
        if (debug_say) {
          this.say('U2H-1')
        }
      }
      else if ((['W49S47', 'W48S47'].indexOf(this.room.name) >= 0) && this.room.storage && ((this.room.storage.store.energy + (this.room.terminal || {store: {energy: 0}}).store.energy) < 20000) && (this.room.controller) && (this.room.controller.ticksToDowngrade > 30000)) {
        this.memory.status = CreepStatus.CHARGE
        if (debug_say) {
          this.say('U2C-2')
        }
        return
      }
      else {
        this.upgradeController(room.controller!)
        // if (((Game.time % 229) == 0) && room.controller) {
        //   // if (((Game.time % 13) == 0) && room.controller) {
        //   if ((room.controller.level < 3) && (!room.controller.sign || (Memory.versions.indexOf(room.controller.sign.text) < 0))) {
        //     this.signController(room.controller, Game.version)
        //   }
        //   else {
        //     const region_memory = Memory.regions[room.name]
        //     if (region_memory && region_memory.sign && (!room.controller.sign || ((region_memory.sign != room.controller.sign.text)))) {
        //       this.signController(room.controller, region_memory.sign)
        //     }
        //   }
        // }

        if (['W45S27', 'W55S13'].indexOf(this.room.name) >= 0) {
          move_to_opt.range = 3
        }

        this.moveTo(room.controller!, move_to_opt)
        return
      }
    }
  }

  Creep.prototype.healNearbyCreep = function(): ActionResult {
    if (!this.hasActiveBodyPart(HEAL)) {
      return ActionResult.IN_PROGRESS
    }

    if (this.hits < this.hitsMax) {
      this.heal(this)
      return ActionResult.IN_PROGRESS
    }
    else {
      const heal_target = this.pos.findInRange(FIND_MY_CREEPS, 3, {
        filter: (creep: Creep) => {
          return creep.hits < creep.hitsMax
        }
      })[0]

      if (heal_target) {
        if (this.pos.isNearTo(heal_target)) {
          this.heal(heal_target)
        }
        else {
          this.rangedHeal(heal_target)
        }
        return ActionResult.IN_PROGRESS
      }
      else {
        this.heal(this)
        return ActionResult.DONE
      }
    }
  }

  Creep.prototype.searchAndDestroyTo = function(room_name: string, attack_anything: boolean, opt?: CreepSearchAndDestroyOption): ActionResult {
    opt = opt || {}
    const memory = this.memory as {target_id?: string}

    if (this.room.name != room_name) {
      let hostile_creep: Creep | null
      if (attack_anything) {
        hostile_creep = this.pos.findClosestByPath(this.room.attacker_info().hostile_creeps, {
          filter: (creep: Creep) => {
            if (creep.owner.username == 'Source Keeper') {
              return false
            }
            return true
          }
        })
      }
      else {
        hostile_creep = this.pos.findInRange(this.room.attacker_info().hostile_creeps, 4, {
          filter: (creep: Creep) => {
            if (creep.owner.username == 'Source Keeper') {
              return false
            }
            return true
          }
        })[0]
      }

      const hostile_nearby = !(!hostile_creep) && this.pos.inRangeTo(hostile_creep.pos.x, hostile_creep.pos.y, 4)

      if (hostile_nearby && hostile_creep) {
        return this.destroy(hostile_creep)
      }

      if (memory.target_id) {
        const specified_target = Game.getObjectById(memory.target_id) as Creep | Structure | undefined

        if (specified_target) {
          return this.destroy(specified_target)
        }
      }

      if (hostile_creep) {
        this.destroy(hostile_creep, opt)

        if (opt.no_move) {
          this.moveToRoom(room_name)
        }

        return ActionResult.IN_PROGRESS
      }
    }

    if (this.moveToRoom(room_name) == ActionResult.IN_PROGRESS) {
      this.healNearbyCreep()
      return ActionResult.IN_PROGRESS
    }

    return this.searchAndDestroy(opt)
  }

  Creep.prototype.searchAndDestroy = function(opt?: CreepSearchAndDestroyOption): ActionResult {
    opt = opt || {}

    const memory = this.memory as {target_id?: string}

    const hostile_attacker: Creep | null = this.pos.findClosestByPath(this.room.attacker_info().hostile_creeps, {
      filter: (creep: Creep) => {
        const is_attacker = creep.body.filter((body: BodyPartDefinition) => {
          return (body.type == ATTACK) || (body.type == RANGED_ATTACK) || (body.type == HEAL)
        }).length > 0

        if (!is_attacker) {
          return false
        }

        if (opt!.ignore_source_keeper && creep.owner.username == 'Source Keeper') {
          return false
        }
        return true
      }
    })

    const hostile_nearby = !(!hostile_attacker) && this.pos.inRangeTo(hostile_attacker.pos.x, hostile_attacker.pos.y, 4)

    if (hostile_nearby && hostile_attacker) {
      return this.destroy(hostile_attacker)
    }

    if (hostile_attacker && opt.move_while_healing) {
      const range = this.pos.getRangeTo(hostile_attacker)

      if (range > 5) {
        this.moveTo(hostile_attacker, {maxRooms: 1})
      }
    }

    if ((this.hits < (this.hitsMax * 0.9)) && (this.getActiveBodyparts(HEAL) > 3)) {
      this.heal(this)
      return ActionResult.IN_PROGRESS
    }

    if (memory.target_id) {
      const specified_target = Game.getObjectById(memory.target_id) as Creep | Structure | undefined

      if (specified_target) {
        return this.destroy(specified_target)
      }
    }

    const hostile_tower: StructureTower = this.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType == STRUCTURE_TOWER
      }
    }) as StructureTower
    if (hostile_tower) {
      return this.destroy(hostile_tower)
    }

    const hostile_spawn: StructureSpawn | null = this.pos.findClosestByPath(FIND_HOSTILE_SPAWNS)
    if (hostile_spawn) {
      return this.destroy(hostile_spawn)
    }

    const hostile_creep: Creep | null = this.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {  // workers
      filter: (creep) => {
        if (Game.isEnemy(creep.owner) == false) {
          return false
        }
        if (creep.pos.x == 0) {
          return false
        }
        if (creep.pos.x == 49) {
          return false
        }
        if (creep.pos.y == 0) {
          return false
        }
        if (creep.pos.y == 49) {
          return false
        }
        if (opt!.ignore_source_keeper && creep.owner.username == 'Source Keeper') {
          return false
        }
        return true
      }
    })
    if (hostile_creep) {
      return this.destroy(hostile_creep)
    }

    const include_non_ownable_structure = opt.include_non_ownable_structure || false

    const ignore: StructureConstant[] = [
      STRUCTURE_CONTROLLER,
      STRUCTURE_RAMPART,
      STRUCTURE_WALL,
      STRUCTURE_KEEPER_LAIR,
      STRUCTURE_POWER_BANK,
      STRUCTURE_EXTRACTOR,
    ]

    const non_ownable_structures: StructureConstant[] = [
      STRUCTURE_ROAD,
      STRUCTURE_CONTAINER,
    ]

    const hostile_structure: AnyStructure | null = this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => {
        if (structure.room.controller && structure.room.controller.my) {
          return false
        }
        if ((structure as AnyOwnedStructure).my) {
          return false
        }

        if (ignore.indexOf(structure.structureType) >= 0) {
          return false
        }
        // if (structure.structureType == STRUCTURE_EXTRACTOR) {  // creeps try destroying extractor in the center room
        //   if (this.room.is_keeperroom) {
        //     return false
        //   }
        // }
        if ((structure as {my?: boolean}).my) {
          return false
        }

        if ((non_ownable_structures.indexOf(structure.structureType) >= 0)) {
          if (include_non_ownable_structure) {
            if ((structure.structureType) == STRUCTURE_CONTAINER) {
              if (structure.room.controller) {
                if (structure.room.controller.my) {
                  return false
                }
                else if (structure.room.controller.owner) {
                  return true
                }
                else if (structure.room.controller.reservation && (structure.room.controller.reservation.username != Game.user.name)) {
                  return true
                }
              }
              return false
            }
            if ((structure.structureType) == STRUCTURE_ROAD) {
              if (structure.room.controller) {
                if (structure.room.controller.my) {
                  return false
                }
                else if (structure.room.controller.owner) {
                  return true
                }
                else if (structure.room.controller.reservation && (structure.room.controller.reservation.username != Game.user.name)) {
                  return true
                }
              }
              return false
            }
          }
          else {
            return false
          }
        }
        return true
      }
    })
    if (hostile_structure) {
      return this.destroy(hostile_structure)
    }

    this.healNearbyCreep()

    // console.log('searchAndDestroy done')
    return ActionResult.DONE
  }

  Creep.prototype.destroy = function(target: Creep | Structure, opt?: CreepDestroyOption): ActionResult {
    opt = opt || {}

    if (this.spawning) {
      return ActionResult.IN_PROGRESS
    }

    if ((target as {my: boolean}).my) {
      this.say(`ERR!!`)
      const message = `Creep.destroy this IS my Creep | Structure ${target} ${target.pos} attacker: ${this.name}`
      console.log(message)
      Game.notify(message)
      return ActionResult.IN_PROGRESS
    }

    const is_ranged_attacker = this.hasActiveBodyPart(RANGED_ATTACK) && !this.hasActiveBodyPart(ATTACK)

    // if (is_ranged_attacker && (this.pos.getRangeTo(target) <= 1)) {
    //   opt.no_move = true
    // }

    if (((Game.time % 3) == 0) && !(this.memory as {should_silent?: boolean}).should_silent) {
      this.say(`T${target.pos.x},${target.pos.y}`)
    }

    let ranged_target: Creep | Structure = target
    let next_move: 'stay' | 'chase' | 'flee' = opt.no_move ? 'stay' : 'chase'
    const is_creep = !(!(target as Creep).carry)

    if (is_creep) {
      if (!opt.no_move && is_ranged_attacker) {
        const hostile_creep = target as Creep
        const range_to_hostile_creep = this.pos.getRangeTo(hostile_creep)
        if (range_to_hostile_creep < 3) {
          const filter = function(creep: Creep): boolean {
            return creep.hasActiveBodyPart(ATTACK) || creep.hasActiveBodyPart(RANGED_ATTACK)
          }
          if (hostile_creep.hasActiveBodyPart(ATTACK) || (hostile_creep.pos.findInRange(hostile_creep.room.attacker_info().hostile_creeps, 2, {filter}).length > 1)) {
            next_move = 'flee'
          }
        }
        else if (range_to_hostile_creep == 3) {
          next_move = 'stay'
        }
      }
    }
    else {
      const creep_nearby = this.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
        filter: (creep: Creep) => {
          return Game.isEnemy(creep.owner)
        }
      })[0]

      if (creep_nearby) {
        ranged_target = creep_nearby
      }
    }

    const ranged_attack_result = this.rangedAttack(ranged_target) // @todo: If target only has ATTACK, run and rangedAttack
    const attack_result = this.attack(target)

    if (attack_result != OK) {
      this.heal(this)
    }

    // const move_to_result = no_move ? OK : this.moveTo(target)
    // if ((ranged_attack_result != OK) || (move_to_result != OK) || (attack_result != OK)) {
    //   console.log(`Creep.destroy action failed ${ranged_attack_result}, ${move_to_result}, ${attack_result}, ${this.name}`)
    // }

    switch (next_move) {
      case 'stay':
        break

      case 'flee': {
        this.say(`FLEE`)  // @fixme

        const goal: {pos: RoomPosition, range: number} = {
          pos: target.pos,
          range: 8,
        }
        const path: PathFinderPath = PathFinder.search(this.pos, goal, {
          flee: true,
          maxRooms: 1,
        })

        if (path.path.length > 0) {
          this.say(`FLEEp`)  // @fixme
          // console.log(`FLEE ${path.path} ${path.path[0] ? path.path[0] : "NO PATH"}, incompleted: ${path.incomplete} ${this.name}`)

          this.moveByPath(path.path)
          return ActionResult.IN_PROGRESS // @todo: Check if finished
        }
        // break  // no need
      }

      case 'chase':
        this.moveTo(target, {
          maxRooms: 1
        })
        break
    }

    return ActionResult.IN_PROGRESS // @todo: Check if finished
  }

  Creep.prototype.claim = function(target_room_name: string, should_claim?: boolean): ActionResult {

    if (this.body.map(part => part.type).indexOf(CLAIM) == -1) {
      console.log(`Creep.claim doesn't have CLAIM body part ${this.body.map(part => part.type)}, ${this.name}`)
      return ActionResult.IN_PROGRESS
    }

    const room = Game.rooms[target_room_name]
    if (!room) {
      this.say(target_room_name)
      this.moveToRoom(target_room_name)
      return ActionResult.IN_PROGRESS
    }

    const target = room.controller!
    if (target.my) {
      return ActionResult.DONE
    }

    let result: number
    let action: string

    if ((target.owner && target.owner.username) && (target.ticksToDowngrade > 1000)) {
      action = 'attackController'
      result = this.attackController(target)

      if ((result != OK) && (result != ERR_NOT_IN_RANGE)) {
        this.say(`A.1${result}`)
      }
    }
    else if (should_claim) {
      if (target.reservation && (target.reservation.ticksToEnd > 0) && (target.reservation.username != Game.user.name)) {
        action = 'attackController'
        result = this.attackController(target)

        if ((result != OK) && (result != ERR_NOT_IN_RANGE)) {
          this.say(`A.2${result}`)
        }
      }
      else {
        action = 'claimController'
        result = this.claimController(target)

        if ((result != OK) && (result != ERR_NOT_IN_RANGE)) {
          this.say(`C${result}`)
        }
        if (result = ERR_GCL_NOT_ENOUGH) {
          this.reserveController(target)
        }
      }
    }
    else {
      action = 'reserveController'
      result = this.reserveController(target)

      if ((result != OK) && (result != ERR_NOT_IN_RANGE)) {
        this.say(`R${result}`)
      }
    }

    switch (result) {
      case OK:
        if (action == 'claimController') {
          return ActionResult.DONE
        }

      case ERR_BUSY:
      case ERR_TIRED:
        return ActionResult.IN_PROGRESS

      case ERR_NOT_IN_RANGE:
        this.moveTo(target, {
          maxRooms: 1,
        })
        return ActionResult.IN_PROGRESS

      case ERR_GCL_NOT_ENOUGH:
        if ((Game.time % 29) == 19) {
          console.log(`Creep.claim ${action} GCL not enough ${result}, ${this.name}`)
        }
        this.moveTo(target)
        this.reserveController(target)
        return ActionResult.IN_PROGRESS

      default:
        if ((result == ERR_INVALID_TARGET) && (action == 'claimController')) {
        }
        else {
          console.log(`Creep.claim ${action} Unexpected return code ${result}, ${this.name} at ${room_link(this.room.name)}`)
        }
        break
    }

    return ActionResult.IN_PROGRESS
  }
}

const resources_should_store_in_storage: ResourceConstant[] = [
  RESOURCE_UTRIUM_HYDRIDE,
  RESOURCE_UTRIUM_OXIDE,
  RESOURCE_UTRIUM_ACID,
  RESOURCE_UTRIUM_ALKALIDE,
  RESOURCE_KEANIUM_HYDRIDE,
  RESOURCE_KEANIUM_OXIDE,
  RESOURCE_KEANIUM_ACID,
  RESOURCE_KEANIUM_ALKALIDE,
  RESOURCE_LEMERGIUM_HYDRIDE,
  RESOURCE_LEMERGIUM_OXIDE,
  RESOURCE_LEMERGIUM_ACID,
  RESOURCE_LEMERGIUM_ALKALIDE,
  RESOURCE_ZYNTHIUM_HYDRIDE,
  RESOURCE_ZYNTHIUM_OXIDE,
  RESOURCE_ZYNTHIUM_ACID,
  RESOURCE_ZYNTHIUM_ALKALIDE,
]
