import { requestCreep } from "objective/bridging/creep_provider_bridging_squad"
import {
  decodeObjectivesFrom,
  Objective,
  ObjectiveFailed,
  ObjectiveInProgress,
  ObjectiveProgressType,
  ObjectiveState,
  ObjectiveSucceeded
} from "objective/objective"
import { SpawnPriorityHigh, SpawnPriorityLow, SpawnPriorityNormal } from "objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { Migration } from "utility/migration"
import { ResultSucceeded, ResultType } from "utility/result"
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
  m: CreepMemory
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
  private readonly requestCreepResult: ResultType<void, string> | null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private readonly creepName: CreepName,
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

  private requestCreep(spawnRoomName: string, bodyParts: BodyPartConstant[], priority: SingleCreepProviderSpawnPriority): ResultType<void, string> {
    if (this.isOldRoom(spawnRoomName) === true) {
      const spec: CreepProviderObjectiveCreepSpec = {
        creepName: this.creepName,
        priority: 2,
        bodyParts: bodyParts,
      }
      return requestCreep(spec, 1, spawnRoomName)
    } else {
      if (Memory.creepRequests[spawnRoomName] == null) {
        Memory.creepRequests[spawnRoomName] = []
      }

      const memory: CreepMemory = {
        ts: null,
        tt: 0,
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
      return new ResultSucceeded(undefined)
    }
  }

  private isOldRoom(spawnRoomName: string): boolean {
    return Migration.isOldRoom(spawnRoomName) === true
  }
}
