import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { StructureSpawnTask, StructureSpawnTaskState } from "game_object_task/spawn_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

export interface SpawnCreepTaskState extends StructureSpawnTaskState {
  /** creep name */
  n: string

  /** body parts */
  b: BodyPartConstant[]

  /** memory */
  m: CreepMemory
}

export class SpawnCreepTask implements StructureSpawnTask {
  public constructor(
    public readonly startTime: number,
    public readonly creepName: string,
    private readonly body: BodyPartConstant[],
    private readonly memory: CreepMemory,
  ) { }

  public encode(): SpawnCreepTaskState {
    return {
      s: this.startTime,
      t: "SpawnCreepTask",
      n: this.creepName,
      b: this.body,
      m: this.memory,
    }
  }

  public static decode(state: SpawnCreepTaskState): SpawnCreepTask | null {
    return new SpawnCreepTask(state.s, state.n, state.b, state.m)
  }

  public run(spawn: StructureSpawn): GameObjectTaskReturnCode {
    const result = spawn.spawnCreep(this.body, this.creepName, { memory: this.memory })
    switch (result) {
    case OK:
      return "finished"

    case ERR_NOT_ENOUGH_ENERGY:
      return "in progress"

    case ERR_NAME_EXISTS:
      PrimitiveLogger.fatal(`spawn.spawnCreep() returns ERR_NAME_EXISTS, spawn: ${spawn.name} in ${roomLink(spawn.room.name)}, duplicated name: ${this.creepName}, trying to discard current spawn and retry..`)
      return "failed"

    case ERR_BUSY:
      PrimitiveLogger.log(`spawn.spawnCreep() returns ERR_BUSY possibly programming bug (spawn: ${spawn.name} in ${roomLink(spawn.room.name)})`)
      return "in progress"

    case ERR_INVALID_ARGS:
      PrimitiveLogger.log(`spawn.spawnCreep() returns ERR_INVALID_ARGS possibly programming bug (spawn: ${spawn.name} in ${roomLink(spawn.room.name)}, creep name: ${this.creepName}, body: ${this.body}), trying to discard current spawn and retry..`)
      return "failed"

    case ERR_NOT_OWNER:
      PrimitiveLogger.log(`spawn.spawnCreep() returns ERR_NOT_OWNER possibly programming bug (spawn: ${spawn.name} in ${roomLink(spawn.room.name)}, trying to discard current spawn and retry..`)
      return "failed"

    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.fatal(`spawn.spawnCreep() returns ERR_RCL_NOT_ENOUGH, spawn: ${spawn.name} in ${roomLink(spawn.room.name)}`)
      return "failed"

    default:
      PrimitiveLogger.fatal(`spawn.spawnCreep() returns unexpected return code: ${result}, spawn: ${spawn.name} in ${roomLink(spawn.room.name)}, trying to discard current spawn and retry..`)
      return "failed"
    }
  }
}
