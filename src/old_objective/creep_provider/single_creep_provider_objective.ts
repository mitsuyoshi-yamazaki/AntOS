import { requestCreep } from "old_objective/bridging/creep_provider_bridging_squad"
import {
  decodeObjectivesFrom,
  Objective,
  ObjectiveFailed,
  ObjectiveInProgress,
  ObjectiveProgressType,
  ObjectiveState,
  ObjectiveSucceeded
} from "old_objective/objective"
import { SpawnPriorityHigh, SpawnPriorityLow, SpawnPriorityNormal } from "old_objective/spawn/spawn_creep_objective"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName, V4CreepMemory } from "prototype/creep"
import { roomLink } from "utility/log"
import { Migration } from "utility/migration"
import { Result } from "utility/result"
import { ShortVersion } from "utility/system_info"
import { CreepStatus, CreepType } from "_old/creep"

export type SingleCreepProviderSpawnPriority = SpawnPriorityHigh | SpawnPriorityNormal | SpawnPriorityLow

export interface SingleCreepProviderCreepRequest {
  /** time added to cache */
  t: number

  /** priority */
  p: SingleCreepProviderSpawnPriority

  /** creep name */
  n: string

  /** body parts */
  b: BodyPartConstant[]

  /** memory */
  m: V4CreepMemory
}

export type CreepProviderPriority = 0 | 1 | 2  // 0: high, 2: low

export interface CreepProviderObjectiveCreepSpec {
  creepName: CreepName
  priority: CreepProviderPriority
  bodyParts: BodyPartConstant[]
}

export interface SingleCreepProviderObjectiveState extends ObjectiveState {
  /** requesting creep name */
  n: CreepName
}

export class SingleCreepProviderObjective implements Objective {
  private readonly requestCreepResult: Result<void, string> | null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly creepName: CreepName,
    launchTimeArguments: {
      spawnRoomName: string,
      requestingCreepBodyParts: BodyPartConstant[],
      priority: SingleCreepProviderSpawnPriority,
    } | null
  ) {
    if (launchTimeArguments != null) {
      this.requestCreepResult = this.requestCreep(
        launchTimeArguments.spawnRoomName,
        launchTimeArguments.requestingCreepBodyParts,
        launchTimeArguments.priority
      )
    } else {
      this.requestCreepResult = null
    }
  }

  public encode(): SingleCreepProviderObjectiveState {
    return {
      s: this.startTime,
      t: "SingleCreepProviderObjective",
      c: this.children.map(child => child.encode()),
      n: this.creepName,
    }
  }

  public static decode(state: SingleCreepProviderObjectiveState): SingleCreepProviderObjective {
    const children = decodeObjectivesFrom(state.c)
    return new SingleCreepProviderObjective(state.s, children, state.n, null)
  }

  public progress(): ObjectiveProgressType<void, Creep, string> {
    if (this.requestCreepResult != null && this.requestCreepResult.resultType === "failed") {
      return new ObjectiveFailed(this.requestCreepResult.reason)
    }

    const creep = Game.creeps[this.creepName]
    if (creep == null) {
      return new ObjectiveInProgress<void>(undefined)
    }
    return new ObjectiveSucceeded(creep)
  }

  private requestCreep(spawnRoomName: string, bodyParts: BodyPartConstant[], priority: SingleCreepProviderSpawnPriority): Result<void, string> {
    switch (Migration.roomVersion(spawnRoomName)) {
    case ShortVersion.v3: {
      const spec: CreepProviderObjectiveCreepSpec = {
        creepName: this.creepName,
        priority: 2,
        bodyParts: bodyParts,
      }
      return requestCreep(spec, 1, spawnRoomName)
    }
    case ShortVersion.v4: {
      if (Memory.creepRequests[spawnRoomName] == null) {
        Memory.creepRequests[spawnRoomName] = []
      }

      const memory: V4CreepMemory = {
        ts: null,

        squad_name: "",
        status: CreepStatus.NONE,
        birth_time: Game.time,
        type: CreepType.TAKE_OVER,
        should_notify_attack: false,
        let_thy_die: true,
      }

      Memory.creepRequests[spawnRoomName].push({
        t: Game.time,
        p: priority,
        n: this.creepName,
        b: bodyParts,
        m: memory,
      })
      return Result.Succeeded(undefined)
    }
    case ShortVersion.v5: {
      const message = `Trying to spawn creep in v5 room ${roomLink(spawnRoomName)} that is not implemented yet (${this.constructor.name})`
      PrimitiveLogger.fatal(message)
      return Result.Failed(message)
    }
    }
  }
}
