import { UID } from "utility"
import { Squad, SquadType, SpawnPriority, SpawnFunction, SquadMemory } from "_old/squad/squad"
import { CreepStatus, CreepType } from "_old/creep"
import { CreepProviderObjectiveCreepSpec } from "task/creep_provider/creep_provider_objective"

let requestCacheTime = 0
const squadNames = new Map<string, string>()

export function requestCreep(spec: CreepProviderObjectiveCreepSpec, count: number, roomName: string): void {
  if (requestCacheTime !== Game.time) {
    squadNames.clear()
    for (const squadName in Memory.squads) {
      const squadMemory = Memory.squads[squadName]
      if (squadMemory.type !== SquadType.CREEP_PROVIDER_BRIDGING_SQUAD) {
        continue
      }
      const squadRoomName = squadMemory.owner_name
      squadNames.set(squadRoomName, squadName)
    }
    requestCacheTime = Game.time
  }
  const squadName = squadNames.get(roomName)
  if (squadName == null) {
    console.log(`CreepProviderBridgingSquad in room ${roomName} not found`)
    return
  }
  const memory = Memory.squads[squadName] as CreepProviderBridgingSquadMemory | null
  if (memory == null) {
    console.log(`CreepProviderBridgingSquad ${squadName} memory not found`)
    return
  }
  memory.req.push(spec.specIdentifier)
}

let newCreepCacheTime = 0
const newCreeps = new Map<string, Creep[]>()

export function getNewCreepIn(roomName: string, creepIdentifier: string): Creep | null {
  if (newCreepCacheTime !== Game.time) {
    newCreeps.clear()
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      if (creep.memory.type !== CreepType.CREEP_PROVIDER) {
        continue
      }
      if (creep.memory.squad_name.length === 0) {
        continue
      }
      const creeps = newCreeps.get(creep.room.name) ?? []
      creeps.push(creep)
      newCreeps.set(creep.room.name, creeps)
    }
    newCreepCacheTime = Game.time
  }

  const creeps = newCreeps.get(roomName) ?? []
  for (const creep of creeps) {
    if (creep.name === creepIdentifier) {
      return creep
    }
  }
  return null
}

// -------- //
export interface CreepProviderBridgingSquadMemory extends SquadMemory {
  /** requesting creep identifiers */
  req: string[]
}

/**
 * - [ ] Scout以外のCreepに対応する
 */
export class CreepProviderBridgingSquad extends Squad {
  public get type(): SquadType {
    return SquadType.CREEP_PROVIDER_BRIDGING_SQUAD
  }
  public get spawnPriority(): SpawnPriority {
    const required = this.memory.req.length > 0
    return required ? SpawnPriority.LOW : SpawnPriority.NONE
  }

  private get memory(): CreepProviderBridgingSquadMemory {
    return Memory.squads[this.name] as CreepProviderBridgingSquadMemory
  }

  constructor(readonly name: string, readonly base_room: Room) {
    super(name, base_room)
  }

  public static need_instantiation(): boolean {
    return true
  }

  public static generateNewName(): string {
    return UID(SquadType.CREEP_PROVIDER_BRIDGING_SQUAD)
  }

  public generateNewName(): string {
    return CreepProviderBridgingSquad.generateNewName()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    return energyAvailable >= 50
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const name = this.memory.req[0]
    if (name == null) {
      return
    }

    const body: BodyPartConstant[] = [MOVE]
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CREEP_PROVIDER,
      should_notify_attack: false,
      let_thy_die: true,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })

    if (result === OK) {
      this.memory.req.splice(0, 1)
    } else {
      console.log(`CreepProviderBridgingSquadMemory spawn scout ${name} failed with error: ${result}`)
    }
  }

  public run(): void {
    // do nothing
  }
}
