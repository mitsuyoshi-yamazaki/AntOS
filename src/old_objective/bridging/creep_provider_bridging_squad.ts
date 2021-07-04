import { UID } from "utility"
import { Squad, SquadType, SpawnPriority, SpawnFunction, SquadMemory } from "_old/squad/squad"
import { CreepStatus, CreepType } from "_old/creep"
import { CreepProviderObjectiveCreepSpec } from "old_objective/creep_provider/single_creep_provider_objective"
import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

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
  memory.req[spec.creepName] = spec.bodyParts
  return new ResultSucceeded(undefined)
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
      type: CreepType.TAKE_OVER,
      should_notify_attack: false,
      let_thy_die: true,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })

    switch (result) {
    case OK:
      delete this.memory.req[creepIdentifier]
      return

    case ERR_NOT_OWNER:
      PrimitiveLogger.fatal(`CreepProviderBridgingSquadMemory spawn creep ${name} returns ERR_NOT_OWNER`)
      delete this.memory.req[creepIdentifier]
      return

    case ERR_NAME_EXISTS:
      PrimitiveLogger.fatal(`CreepProviderBridgingSquadMemory spawn creep ${name} returns ERR_NAME_EXISTS`)
      delete this.memory.req[creepIdentifier]
      return

    case ERR_INVALID_ARGS:
      PrimitiveLogger.fatal(`CreepProviderBridgingSquadMemory spawn creep ${name} returns ERR_INVALID_ARGS, body: ${body}`)
      delete this.memory.req[creepIdentifier]
      return


    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.fatal(`CreepProviderBridgingSquadMemory spawn creep ${name} returns ERR_RCL_NOT_ENOUGH`)
      return


    case ERR_BUSY:
    case ERR_NOT_ENOUGH_ENERGY:
      return
    }
  }

  public run(): void {
    // do nothing
  }
}
