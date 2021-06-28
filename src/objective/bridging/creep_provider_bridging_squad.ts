import { UID } from "utility"
import { Squad, SquadType, SpawnPriority, SpawnFunction, SquadMemory } from "_old/squad/squad"
import { CreepStatus, CreepType } from "_old/creep"
import { CreepProviderObjectiveCreepSpec } from "objective/creep_provider/single_creep_provider_objective"
import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"

let requestCacheTime = 0
const squadNames = new Map<string, string>()

export function requestCreep(spec: CreepProviderObjectiveCreepSpec, count: number, roomName: string): ResultType<void, string> {
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
    return new ResultFailed(`CreepProviderBridgingSquad in room ${roomName} not found`)
  }
  const memory = Memory.squads[squadName] as CreepProviderBridgingSquadMemory | null
  if (memory == null) {
    return new ResultFailed(`CreepProviderBridgingSquad ${squadName} memory not found`)
  }
  memory.req[spec.creepIdentifier] = spec.bodyParts
  return new ResultSucceeded(undefined)
}

let newCreepCacheTime = 0
const newCreeps: Creep[] = []

export function getNewCreepIn(creepIdentifier: string): Creep | null {
  if (newCreepCacheTime !== Game.time) {
    newCreeps.splice(0, newCreeps.length)
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      if (creep.spawning) {
        continue
      }
      if (creep.memory.type !== CreepType.CREEP_PROVIDER) {
        continue
      }
      if (creep.memory.squad_name.length === 0) {
        continue
      }
      newCreeps.push(creep)
    }
    newCreepCacheTime = Game.time
  }

  for (const creep of newCreeps) {
    if (creep.name === creepIdentifier) {
      creep.memory.squad_name = ""
      return creep
    }
  }
  return null
}

// -------- //
export interface CreepProviderBridgingSquadMemory extends SquadMemory {
  /** requesting creep identifiers */
  req: {[index: string]: BodyPartConstant[]}
}

/**
 * - [ ] Scout以外のCreepに対応する
 */
export class CreepProviderBridgingSquad extends Squad {
  public get type(): SquadType {
    return SquadType.CREEP_PROVIDER_BRIDGING_SQUAD
  }
  public get spawnPriority(): SpawnPriority {
    const required = Object.keys(this.memory.req).length > 0
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
    const creepIdentifier = Object.keys(this.memory.req)[0]
    if (creepIdentifier == null) {
      return
    }

    const name = creepIdentifier
    const body: BodyPartConstant[] = this.memory.req[creepIdentifier]
    const memory: CreepMemory = {
      ts: null,
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
      delete this.memory.req[creepIdentifier]
    } else {
      console.log(`CreepProviderBridgingSquadMemory spawn scout ${name} failed with error: ${result}`)
    }
  }

  public run(): void {
    // do nothing
  }
}
