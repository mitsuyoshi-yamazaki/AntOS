import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface ControllerKeeperSquadMemory extends SquadMemory {
  readonly room_name: string
}

enum State {
  OWNED     = 'owned',
  NOT_OWNED = 'not_owned',
  MINE      = 'mine',
}

class ControllerKeeperSquad extends Squad {
  constructor(readonly name: string, readonly room_name: string, readonly energy_capacity: number) {
    super(name)

    if (!room_name) {
      console.log(`ControllerKeeperSquad.room_name is not provided ${room_name}, ${this.name}`)
    }

    const room = Game.rooms[this.room_name]
    if (!room) {
      this.myRoom = false
    }
    else if (room.controller) {
      this.myRoom = room.controller!.my
    }
    else {
      this.myRoom = false
    }

    if (this.myRoom) {
      this.state = State.MINE
    }
    else {
      this.state = State.NOT_OWNED
    }
  }

  public readonly myRoom: boolean
  private readonly state: State

  public get type(): SquadType {
    return SquadType.CONTROLLER_KEEPER
  }

  public static generateNewName(): string {
    return UID(SquadType.CONTROLLER_KEEPER)
  }

  public generateNewName(): string {
    return ControllerKeeperSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    let energy_needed: number

    switch (this.state) {
      case State.OWNED:
        energy_needed = 700
        break

      case State.NOT_OWNED: {
        const room = Game.rooms[this.room_name]
        if (room && room.controller && room.controller.reservation && (room.controller.reservation.ticksToEnd > 4000)) {
          return SpawnPriority.NONE
        }
        energy_needed = 650
        break
      }

      case State.MINE:
        // energy_needed = 250
        return SpawnPriority.NONE

      default:
        console.log(`Unexpected state ${this.state}, ${this.name}`)
        return SpawnPriority.NONE
    }
    if (energy_needed > this.energy_capacity) {
      return SpawnPriority.NONE
    }

    const max = 1

    if (this.creeps.size < max) {
      // if (this.room_name == 'E12S19') {
      //   return SpawnPriority.NORMAL
      // }
      return SpawnPriority.LOW
    }
    return SpawnPriority.NONE
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    switch (this.state) {
    case State.OWNED:
      return energy_available >= 700

    case State.NOT_OWNED:
      if (capacity >= 1300) {
        return energy_available >= 1300
      }
      else {
        return energy_available >= 650
      }

    case State.MINE:
      return energy_available >= 250

    default:
      console.log(`Unexpected state ${this.state}, ${this.name}`)
      return false
    }
  }

  // --
  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    switch (this.state) {
      case State.OWNED:
        this.addCreepForAttack(spawnFunc)
        break

      case State.NOT_OWNED:
        this.addCreepForClaim(energyAvailable, spawnFunc)
        break

      case State.MINE:
        this.addCreepForUpgrade(spawnFunc)
        break

      default:
        console.log(`Unexpected state ${this.state}, ${this.name}`)
        break
    }
  }

  public run(): void {
    switch (this.state) {
      case State.OWNED:
        this.attack()
        break

      case State.NOT_OWNED:
        // console.log(`HOGE ${this.name}, ${this.room_name}, ${this.state}, ${this.creeps.size}`)
        this.claim()
        break

      case State.MINE:
        this.upgrade()
        break

      default:
        console.log(`Unexpected state ${this.state}, ${this.name}`)
        break
    }
  }

  public description(): string {
    return `${super.description()}, state: ${this.state}, ${this.room_name}`
  }

  // Private members
  private addCreepForUpgrade(spawnFunc: SpawnFunction): void {
    const body: BodyPartConstant[] = [WORK, CARRY, MOVE, MOVE]
    const name = this.generateNewName()
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CONTROLLER_KEEPER,
      should_notify_attack: false,
      let_thy_die: false,
    }

    const result = spawnFunc(body, name, {
      memory: memory,
    })
  }

  private addCreepForClaim(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const body: BodyPartConstant[] = energyAvailable >= 1300 ? [MOVE, MOVE, CLAIM, CLAIM] : [MOVE, CLAIM]
    const name = this.generateNewName()
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CLAIMER,
      should_notify_attack: false,
      let_thy_die: false,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }

  private addCreepForAttack(spawnFunc: SpawnFunction): void {
    const name = this.generateNewName()
    const body: BodyPartConstant[] = [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE]
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.SCOUT,
      should_notify_attack: false,
      let_thy_die: false,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }

  private attack(): void {
    this.creeps.forEach((creep, _) => {
      const target_room_name = 'E12S19' // @fixme: use this.room_name
      if (creep.moveToRoom(target_room_name) != ActionResult.DONE) {
        return
      }

      const target = creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS)
      creep.drop(RESOURCE_ENERGY)

      if (creep.dismantle(target) == ERR_NOT_IN_RANGE) {
        creep.moveTo(target)
      }
    })
  }

  private upgrade(): void {
    this.creeps.forEach((creep, _) => {
        if (creep.room.name != this.room_name) {
          creep.moveToRoom(this.room_name)
        }

      // const source = (this.room as Room).sources[0]  // @todo: Cache source
        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE)

        if (creep.memory.status == CreepStatus.NONE) {
          creep.memory.status = CreepStatus.HARVEST
        }

        if (creep.memory.status == CreepStatus.HARVEST) {
          if (creep.carry.energy == creep.carryCapacity) {
            creep.memory.status = CreepStatus.UPGRADE
          }
          else if (creep.harvest(source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(source)
            return
          }
        }
        if (creep.memory.status == CreepStatus.UPGRADE) {
          if (creep.carry.energy == 0) {
            creep.memory.status = CreepStatus.HARVEST
          }
          else if (creep.upgradeController(creep.room.controller!) == ERR_NOT_IN_RANGE) {
            if (this.room_name == 'W48S49') {
              creep.moveTo(40, 42)
            }
            else {
              creep.moveTo(creep.room.controller!)
            }
            return
          }
        }
    })
  }

  private claim(): void {
    this.creeps.forEach((creep) => {
      // if (this.room_name == 'W45S42') {
      //   const target_room_name = 'W45S41'
      //   const room_to_attack = Game.rooms[target_room_name]

      //   if (room_to_attack && ((room_to_attack.controller!.upgradeBlocked || 0) < 50)) {
      //     creep.claim(target_room_name)
      //     return
      //   }
      // }
      const should_claim = this.room_name == 'W49S34'

      if (creep.claim(this.room_name, should_claim) == ActionResult.DONE) {
        console.log(`CLAIMED ANOTHER ROOM ${this.room_name}`)
      }
    })
  }
}
