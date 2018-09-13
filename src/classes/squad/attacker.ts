import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface AttackerSquadMemory extends SquadMemory {
  target_room_name: string | undefined
}

export class AttackerSquad extends Squad {
  private destination_room_name: string | undefined
  private attack_unit: BodyPartConstant[] = [ATTACK]
  private energy_unit = 130
  private fix_part_energy = 320
  private max_energy = 1100
  private is_heavy_attacker = false

  constructor(readonly name: string, readonly rooms_to_defend: string[], readonly base_room: Room, readonly energy_capacity: number) {
    super(name)

    const memory = (Memory.squads[this.name] as AttackerSquadMemory)
    let base_room_attacked = false

    if ((this.rooms_to_defend.indexOf(this.base_room.name) >= 0)) {
      this.destination_room_name = this.base_room.name
      base_room_attacked = true
    }
    else if (memory.target_room_name) {
      const room = Game.rooms[memory.target_room_name]

      if (room) {
        if (room.attacker_info().attacked) {
          this.destination_room_name = room.name
        }
        else {
          (Memory.squads[this.name] as AttackerSquadMemory).target_room_name = undefined
          this.destination_room_name = rooms_to_defend[0] ? rooms_to_defend[0] : undefined
        }
      }
      else {
        this.destination_room_name = memory.target_room_name
      }
    }

    if (!this.destination_room_name) {
      this.destination_room_name = rooms_to_defend[0] ? rooms_to_defend[0] : undefined;
    }
    (Memory.squads[this.name] as AttackerSquadMemory).target_room_name = this.destination_room_name

    if (base_room_attacked) {
      const heal_part_count = this.base_room.attacker_info().heal + this.base_room.attacker_info().tough
      let attack_needs = heal_part_count / 2

      if (this.base_room.attacker_info().hostile_teams.indexOf('Invader') >= 0) {
        attack_needs *= 0.7
      }
      attack_needs = Math.ceil(attack_needs)

      if (attack_needs > 6) {
        this.attack_unit = [ATTACK, ATTACK]
        this.energy_unit = 210

        const max = (attack_needs * this.energy_unit) + this.fix_part_energy
        this.max_energy = Math.min((this.energy_capacity - 150), max)

        this.is_heavy_attacker = true
        // console.log(`Attacker ${this.base_room.name} ${this.base_room.attacker_info().heal} * HEAL, ${this.base_room.attacker_info().tough} * TOUGH, need: ${attack_needs}, ${this.energy_unit}, ${this.max_energy}, ${this.base_room.attacker_info().hostile_teams}`)
      }
      else {
        // console.log(`No big attacker ${this.base_room.name} ${this.base_room.attacker_info().heal} * HEAL, ${this.base_room.attacker_info().tough} * TOUGH, need: ${attack_needs}, ${this.energy_unit}, ${this.max_energy}, ${this.base_room.attacker_info().hostile_teams}`)
      }
    }
  }

  public get type(): SquadType {
    return SquadType.ATTACKER
  }

  public static generateNewName(): string {
    return UID(SquadType.ATTACKER)
  }

  public generateNewName(): string {
    return AttackerSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    if (this.energy_capacity < 280) {
      return SpawnPriority.NONE
    }
    if (!this.destination_room_name) {
      return SpawnPriority.NONE
    }

    let max = 1
    if (this.base_room.name == this.destination_room_name) {
      max = 1
    }
    return this.creeps.size < max ? SpawnPriority.URGENT : SpawnPriority.NONE
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    if (capacity < (this.fix_part_energy + this.energy_unit)) {
      if (energyAvailable >= 280) {
        return true
      }
    }

    capacity -= this.fix_part_energy
    const energy_needed = Math.floor(capacity / this.energy_unit) * this.energy_unit // @todo: set upper limit

    return energyAvailable >= Math.min(energy_needed, this.max_energy)
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const front_part: BodyPartConstant[] = [TOUGH, TOUGH, MOVE, MOVE]
    const move: BodyPartConstant[] = [MOVE]

    const name = this.generateNewName()
    let body: BodyPartConstant[] = []
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.ATTACKER,
      should_notify_attack: false,
      let_thy_die: false,
    }

    if (energyAvailable < (this.fix_part_energy + this.energy_unit)) {
      body = [MOVE, ATTACK, RANGED_ATTACK]
    }
    else {
      energyAvailable = Math.min(energyAvailable, this.max_energy)
      energyAvailable -= this.fix_part_energy

      while(energyAvailable >= this.energy_unit) {
        body = move.concat(body)
        body = body.concat(this.attack_unit)

        energyAvailable -= this.energy_unit
      }
      body = front_part.concat(body)
      body = body.concat([RANGED_ATTACK, MOVE])
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })

    if ((result == OK) && this.is_heavy_attacker) {
      const region_memory = Memory.regions[this.base_room.name]
      let teams: string[] = []

      if (region_memory) {
        teams = this.base_room.attacker_info().hostile_teams

        region_memory.last_heavy_attacker = {
          ticks: Game.time,
          body,
          teams,
        }
      }

      const url = `https://screeps.com/a/#!/history/shard2/${this.base_room.name}?t=${Game.time}`
      const link = `<a href="${url}">${Game.time}</a>`
      const message = `AttackerSquad.addCreep spawn a heavy attacker ${this.base_room.name}, ${teams}, ${this.name} at ${link}  `

      console.log(message)
      Game.notify(message)
    }
  }

  public run(): void {
    this.creeps.forEach((attacker) => {
      if (attacker.spawning) {
        return
      }

      const is_safemode_active = (attacker.room.controller) ? ((attacker.room.controller!.safeMode || 0) > 0) : false

      // if (attacker.room.name == 'W43N7') {

      // }
      // else {
        const target = attacker.pos.findClosestByPath(FIND_HOSTILE_CREEPS)
        if (target) {
          attacker.destroy(target)
          return
        }
      // }

      if (!this.destination_room_name) {
        if (attacker.moveToRoom(this.base_room.name) == ActionResult.DONE) {
          switch (attacker.room.name) {
            case 'W51S29':
              attacker.moveTo(9, 30)
              break

            case 'W44S7':
              attacker.moveTo(26, 37)
              break

            case 'W48S6':
              attacker.moveTo(24, 28)
              break

            case 'W43S5':
              attacker.moveTo(19, 20)
              break

            case 'W47S6':
              attacker.moveTo(25, 25)
              break

            case 'W45S27':
              attacker.moveTo(18, 28)
              break

            case 'W45S3':
              attacker.moveTo(30, 33)
              break

            case 'W47S9':
              attacker.moveTo(42, 6)
              break

            case 'W46S3':
              attacker.moveTo(39, 44)
              break

            case 'E16N37':
              attacker.moveTo(4, 27)
              break

            case 'W56S7':
              attacker.moveTo(8, 3)
              break

            case 'W55S23':
              attacker.moveTo(10, 47)
              break

            case 'W54S7':
              attacker.moveTo(38, 22)
              break

            default:
              attacker.moveTo(25, 25)
              // console.log(`Attacker unexpected waiting room ${attacker.room}, ${attacker.name}, ${this.name}`)
              break
          }
        }
        return
      }

      // const hostile_creep: Creep = attacker.pos.findClosestByPath(FIND_HOSTILE_CREEPS)
      // if (hostile_creep) {
      //   if (Game.time % 5) {
      //     attacker.say('FOUND YOU', true)
      //   }

      //   const rr = attacker.rangedAttack(hostile_creep)
      //   if (rr == ERR_NOT_IN_RANGE) {
      //     const r = attacker.moveTo(hostile_creep)
      //     // console.log(`FUGA ${attacker}, ${r}, ${hostile_creep}, ${hostile_creep.pos}`)
      //   }
      //   // console.log(`HOGE ${attacker}, ${rr}, ${hostile_creep}, ${hostile_creep.pos}`)
      //   return
      // }

      // if (!this.destination) {
      //   // console.log(`Attacker wait ${attacker!.name}, ${this.name}`)
      //   // if (attacker!.moveToRoom(this.room_for_wait.name) == ActionResult.IN_PROGRESS) {
      //   //   attacker!.say(this.room_for_wait.name)
      //   // }
      //   return
      // }

      if (attacker.room.name == 'W43N7') {

      }
      else {
        attacker.searchAndDestroy()
      }

      if (attacker.moveToRoom(this.destination_room_name) != ActionResult.DONE) {
        attacker.say(this.destination_room_name)
        return
      }
    })
  }

  public description(): string {
    const attacker = Array.from(this.creeps.values())[0]
    const attacker_info = attacker ? `${attacker.name} ${attacker.pos}` : ''
    return `${super.description()}, ${attacker_info}\n    - to ${this.destination_room_name} (${this.rooms_to_defend})`
  }

  // -- Private --
  private suicide(): void {
    // @todo:
  }

  private addAttacker(spawnFunc: SpawnFunction) {
    // @todo:
  }

  private addHealer(spawnFunc: SpawnFunction) {
    // @todo:
  }
}
