import { UID } from "../../utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "_old/creep"

interface ScoutCreepMemory extends CreepMemory {
  readonly room_name: string
}

export class ScoutSquad extends Squad {
  private creep_for_room = new Map<string, Creep>()
  private room_needs_scout: string | undefined

  public static need_instantiation(memory: SquadMemory, controller: StructureController): boolean {
    const squad_creeps = Game.squad_creeps[memory.name]
    if (squad_creeps && (squad_creeps.length > 0)) {
      return true
    }

    // no creeps
    if (memory.stop_spawming) {
      return false
    }

    return true
  }

  constructor(readonly name: string, readonly base_room: Room, readonly room_names: string[]) {
    super(name, base_room)

    this.creeps.forEach((creep) => {
      const memory = creep.memory as ScoutCreepMemory
      if (!memory.room_name) {
        console.log(`ScoutSquad creep doesn't have room name ${creep.name}, ${this.name}`)
        return
      }
      this.creep_for_room.set(memory.room_name, creep)
    })

    this.room_needs_scout = this.room_names.filter((name) => {
      return !this.creep_for_room.get(name)
    })[0]
  }

  public get type(): SquadType {
    return SquadType.SCOUT
  }

  public static generateNewName(): string {
    return UID(SquadType.SCOUT)
  }

  public generateNewName(): string {
    return ScoutSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    const needs_spawn = this.creep_for_room.size < this.room_names.length
    return needs_spawn ? SpawnPriority.LOW : SpawnPriority.NONE
    // return SpawnPriority.NONE // @fixme: temp
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    let energy_need = 50

    if (this.room_needs_scout == 'W48S33') {
      energy_need = 70
    }

    return energyAvailable >= 50
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    if (!this.room_needs_scout) {
      console.log(`ScoutSquad.addCreep no room that needs scout ${this.name}, ${this.room_names}`)
      return
    }

    const body: BodyPartConstant[] = (this.room_needs_scout == 'W48S33') ? [TOUGH, TOUGH, MOVE] : [MOVE]
    const name = this.generateNewName()
    const memory: ScoutCreepMemory = {
      ts: null,
      tt: 0,
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.SCOUT,
      should_notify_attack: false,
      room_name: this.room_needs_scout,
      let_thy_die: true,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }

  public run(): void {
    this.creep_for_room.forEach((creep, room_name) => {
      if (creep.spawning) {
        return
      }

      if (creep.memory.stop) {
        // destroy hostile construction sites
        // if (creep.name == 'scout85231983') {
        //   const site = creep.pos.findClosestByPath(FIND_HOSTILE_CONSTRUCTION_SITES)
        //   if (site) {
        //     creep.moveTo(site, {maxRooms: 1})
        //   }
        // }
        return
      }

      if (creep.moveToRoom(room_name) == ActionResult.IN_PROGRESS) {
        return
      }

      const opt: MoveToOpts = {
        maxRooms: 1,
        maxOps: 500,
        reusePath: 10,
      }

      if (creep.room.controller && (creep.moveTo(creep.room.controller, opt) == OK)) {
        const emoji = ['😆', '😄', '😐', '😴', '🤔', '🙃', '😃', '😑', '😖', '😝']
        const index = (Number(creep.room.name.slice(1,3)) + Number(creep.room.name.slice(4,6))) % emoji.length
        const sign = emoji[index]

        if (creep.signController(creep.room.controller, sign) == OK) {
          creep.memory.stop = true

          const x = (creep.pos.x - creep.room.controller.pos.x) + creep.pos.x
          const y = (creep.pos.y - creep.room.controller.pos.y) + creep.pos.y

          creep.moveTo(new RoomPosition(x, y, creep.room.name))

          if (creep.room.name == 'W31S9') {
            const message = `ScoutSquad.run arrived ${creep.room.name} at ${Game.time} with ${creep.ticksToLive}`
            console.log(message)
            Game.notify(message)
          }
        }

        return
      }

      if (creep.pos.x == 1) {
        if (creep.move(RIGHT) == OK) {
          return
        }
      }
      if (creep.pos.x == 48) {
        if (creep.move(LEFT) == OK) {
          return
        }
      }
      if (creep.pos.y == 1) {
        if (creep.move(BOTTOM) == OK) {
          return
        }
      }
      if (creep.pos.y == 48) {
        if (creep.move(TOP) == OK) {
          return
        }
      }

      creep.moveTo(new RoomPosition(25, 25, creep.room.name), opt)
    })
  }

  public description(): string {
    return `${super.description()}, ${this.room_names}`
  }
}
