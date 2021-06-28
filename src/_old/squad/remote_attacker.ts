import { UID } from "../../utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "_old/creep"

interface Pair {
  name: string,
  room_name: string,
  attacker: Creep | undefined,
  healer: Creep | undefined,
  need_healer: boolean,
}

interface RemoteAttackerSquadMemory extends CreepMemory {
  pair_name: string,
}

export class RemoteAttackerSquad extends Squad {
  private boost_lab_ids = new Map<ResourceConstant, string>()
  private boost_labs = new Map<ResourceConstant, StructureLab>()
  private pairs = new Map<string, Pair>()
  private spawming_pairs: Pair | undefined
  private spawn_pairs_name: string | undefined
  private carrier: Creep | undefined

  constructor(readonly name: string, readonly base_room: Room, readonly target_room: string) {
    super(name, base_room)

    if (this.base_room.name == 'W47N2') {
      // this.boost_lab_ids.set(RESOURCE_CATALYZED_UTRIUM_ACID, '5b378bd089b8230740d3f5dd')
    }

    this.boost_lab_ids.forEach((id, resource_type) => {
      const lab = Game.getObjectById(id) as StructureLab | undefined

      if (!lab) {
        console.log(`RemoteAttackerSquad lab ${id} not found ${this.base_room.name} ${this.name}`)
        return
      }

      this.boost_labs.set(resource_type, lab)
    })

    this.creeps.forEach((creep) => {
      const memory = creep.memory as RemoteAttackerSquadMemory
      let pair: Pair | undefined = this.pairs.get(memory.pair_name || "")

      if (!pair) {
        const pair_name = memory.pair_name || this.newPairName()

        pair = {
          name: pair_name,
          room_name: creep.room.name,
          attacker: undefined,
          healer: undefined,
          need_healer: true,
        }

        this.pairs.set(pair_name, pair)
      }

      (creep.memory as RemoteAttackerSquadMemory).pair_name = pair.name

      switch (creep.memory.type) {
        case CreepType.ATTACKER:
          pair.attacker = creep
          if (pair.need_healer == true) {
            if (creep.room.name != this.base_room.name) {
              pair.need_healer = false
            }
          }
          break

        case CreepType.HEALER:
          pair.healer = creep
          pair.need_healer = false
          break

        case CreepType.CARRIER:
          this.carrier = creep
          break

        default:
          console.log(`RemoteAttackerSquad unexpected creep type ${creep.memory.type}, ${this.name}`)
          break
        }
    })
  }

  private newPairName(): string {
    return UID(`pair${Game.time}`)
  }

  public get type(): SquadType {
    return SquadType.REMOTE_ATTACKER
  }

  public static generateNewName(): string {
    return UID('RA')
  }

  public generateNewName(): string {
    return RemoteAttackerSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    if (!this.carrier) {
      return SpawnPriority.URGENT
    }
    return SpawnPriority.NONE

    // const max_pairs = 3

    // if (this.pairs.size >= max_pairs) {
    //   return SpawnPriority.NONE
    // }

    // const pair_needs_spawn = Array.from(this.pairs.values()).filter((pair) => {
    //   if (pair.attacker && pair.healer) {
    //     return false
    //   }
    //   if (!pair.need_healer) {
    //     return false
    //   }
    //   return true
    // })[0]

    // if (pair_needs_spawn) {
    //   this.spawn_pairs_name = pair_needs_spawn.name

    //   if (!pair_needs_spawn.attacker) {
    //     return SpawnPriority.NORMAL
    //   }
    //   else if (!pair_needs_spawn.healer) {
    //     return SpawnPriority.URGENT
    //   }
    //   else {
    //     console.log(`RemoteAttackerSquadMemory.spawnPriority error1 ${pair_needs_spawn}, ${pair_needs_spawn.name}, ${this.name}, ${this.base_room.name}`)
    //     return SpawnPriority.NONE
    //   }
    // }

    // const pair: Pair = {
    //   name: this.newPairName(),
    //   room_name: this.base_room.name,
    //   attacker: undefined,
    //   healer: undefined,
    //   need_healer: false,
    // }

    // this.pairs.set(pair.name, pair)
    // this.spawn_pairs_name = pair.name

    // return SpawnPriority.NORMAL

    // --

    // const hostile_creeps = this.base_room.attacker_info.hostile_creeps.filter((creep) => {
    //   return creep.owner.username == 'x3mka'
    // })

    // if (hostile_creeps.length == 0) {
    //   if (['W47N2', 'W43N5'].indexOf(this.base_room.name) >= 0) {
    //     return this.creeps.size < 2 ? SpawnPriority.LOW : SpawnPriority.NONE
    //   }
    //   return SpawnPriority.NONE
    // }

    // return this.creeps.size < 5 ? SpawnPriority.URGENT : SpawnPriority.NONE
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    return energy_available >= 3820
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    if (!this.carrier) {
      this.addCarrier(energy_available, spawn_func)
      return
    }

    if (!this.spawn_pairs_name) {
      console.log(`RemoteAttackerSquadMemory.addCreep no spawn_pairs_name ${this.name}, ${this.base_room.name}`)
      return
    }

    // const pair = this.pairs.get(this.spawn_pairs_name)
    // if (!pair) {
    //   console.log(`RemoteAttackerSquadMemory.addCreep no pair for spawn_pairs_name ${this.name}, ${this.base_room.name}`)
    //   return
    // }

    // if (!pair.attacker) {
    //   this.addAttacker(energy_available, spawn_func, this.spawn_pairs_name)
    //   return
    // }

    // this.addHealer(energy_available, spawn_func, this.spawn_pairs_name)
    // return
  }

  public run(): void {

    this.runCarrier()

    this.pairs.forEach((pair) => {
      this.runPair(pair)
    })

    // this.creeps.forEach((creep) => {
    //   if (creep.searchAndDestroy() == ActionResult.DONE) {
    //     switch (this.base_room.name) {
    //       case 'W47N2':
    //         creep.moveTo(37, 9)
    //         break

    //       case 'W43N5':
    //         creep.moveTo(2, 25)
    //         break

    //       default:
    //         creep.moveTo(25, 25)
    //     }
    //   }
    // })
  }

  // ----
  private addCarrier(energy_available: number, spawn_func: SpawnFunction): void {
    const body: BodyPartConstant[] = [
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]

    const name = this.generateNewName()
    const memory: RemoteAttackerSquadMemory = {
      ts: null,
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CARRIER,
      should_notify_attack: false,
      let_thy_die: true,
      pair_name: "",
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  private addAttacker(energy_available: number, spawn_func: SpawnFunction, pairs_name: string): void {
    const body: BodyPartConstant[] = [
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]

    const name = this.generateNewName()
    const memory: RemoteAttackerSquadMemory = {
      ts: null,
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.ATTACKER,
      should_notify_attack: false,
      let_thy_die: true,
      pair_name: pairs_name,
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  private addHealer(energy_available: number, spawn_func: SpawnFunction, pairs_name: string): void {
    const body: BodyPartConstant[] = [
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL, HEAL, HEAL, HEAL,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]

    const name = this.generateNewName()
    const memory: RemoteAttackerSquadMemory = {
      ts: null,
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.HEALER,
      should_notify_attack: false,
      let_thy_die: true,
      pair_name: pairs_name,
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  // ---
  private runCarrier(): void {
    if (!this.carrier || !this.base_room.terminal) {
      return
    }

    const creep = this.carrier
    const terminal = this.base_room.terminal

    let lack_of_resource: ResourceConstant | null = null

    Array.from(this.boost_labs.keys()).forEach((resource_type) => {
      if (lack_of_resource) {
        return
      }
      const lab = this.boost_labs.get(resource_type)
      if (!lab) {
        console.log(`RemoteAttackerSquadMemory.runCarrier unknown error2 ${lack_of_resource}, ${this.name}, ${this.base_room.name}`)
        return
      }

      if ((lab.mineralCapacity - lab.mineralAmount) >= 1000) {
        const amount = (creep.carry[resource_type] || 0) + (terminal.store[resource_type] || 0)
        if (amount > 0) {
          lack_of_resource = lab.mineralType
        }
      }
    })

    if (!lack_of_resource) {
      creep.say(`raDONE`)
      return
    }

    const lab = this.boost_labs.get(lack_of_resource)
    if (!lab) {
      console.log(`RemoteAttackerSquadMemory.runCarrier unknown error ${lack_of_resource}, ${this.name}, ${this.base_room.name}`)
      return
    }

    const carry = creep.store.getUsedCapacity()

    if (carry > 0) {
      const transfer_result = creep.transfer(lab, lack_of_resource)
      if (transfer_result == ERR_NOT_IN_RANGE) {
        creep.moveTo(lab)
      }
      else if (transfer_result != OK) {
        creep.say(`E${transfer_result}`)
      }
      return
    }
    else {
      const withdraw_result = creep.withdraw(terminal, lack_of_resource)
      if (withdraw_result == ERR_NOT_IN_RANGE) {
        creep.moveTo(terminal)
      }
      else if (withdraw_result != OK) {
        creep.say(`E${withdraw_result}`)
      }
      return
    }
  }

  private runPair(pair: Pair): void {
    if (pair.attacker) {
      this.runAttacker(pair.attacker, pair.healer, pair)
    }

    if (pair.healer) {
      this.runHealer(pair.healer, pair.attacker, pair)
    }
  }

  private runAttacker(creep: Creep, healer: Creep | undefined, pair: Pair): void {
    // boost

    if (pair.need_healer) {
      // boost
      return
    }

    const target_room_name = 'W44N3'

    ;(creep.memory as {target_id?: string}).target_id = '5b44396305ef4734411685e5' // rampart
    creep.searchAndDestroyTo(target_room_name, false)

    if (healer && (creep.room.name == healer.room.name)) {
      const range = creep.pos.getRangeTo(healer)

      if ((range > 1) && (range < 4)) {
        creep.moveTo(healer)
      }
    }
  }

  private runHealer(creep: Creep, attacker: Creep | undefined, pair: Pair): void {
    // boost

    if (attacker) {
      creep.moveTo(attacker)
    }
    else {
      const target = creep.pos.findClosestByPath(FIND_MY_CREEPS)

      if (target) {
        creep.moveTo(target)
      }
    }

    creep.healNearbyCreep()
  }
}
