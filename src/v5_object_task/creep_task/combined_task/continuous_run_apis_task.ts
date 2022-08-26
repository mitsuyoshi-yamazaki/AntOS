import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { TargetingApiWrapperTargetType } from "v5_object_task/targeting_api_wrapper"
import { TaskProgressType } from "v5_object_task/object_task"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"

type ContinuousRunApiTaskApiWrapperStatus = "in_progress" | "failed"

export interface ContinuousRunApiTaskOptions {
}

export interface ContinuousRunApiTaskState extends CreepTaskState {
  /** api warpper states */
  as: CreepApiWrapperState[]
}

export class ContinuousRunApiTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TargetingApiWrapperTargetType> | undefined {
    return undefined  // FixMe: 中途半端に行うとキャッシュにTaskRunnerが残り続けてしまう
  }

  private constructor(
    public readonly startTime: number,
    private readonly apiWrappers: AnyCreepApiWrapper[],
  ) {
    this.shortDescription = "multi"
  }

  public encode(): ContinuousRunApiTaskState {
    return {
      s: this.startTime,
      t: "ContinuousRunApiTask",
      as: this.apiWrappers.map(wrapper => wrapper.encode()),
    }
  }

  public static decode(state: ContinuousRunApiTaskState): ContinuousRunApiTask | null {
    const wrappers = state.as.flatMap(wrapperState => decodeCreepApiWrapperFromState(wrapperState) ?? [])
    return new ContinuousRunApiTask(state.s, wrappers)
  }

  public static create(apiWrappers: AnyCreepApiWrapper[]): ContinuousRunApiTask {
    return new ContinuousRunApiTask(Game.time, apiWrappers)
  }

  public run(creep: Creep): TaskProgressType {
    let failed = false as boolean

    this.apiWrappers.forEach(wrapper => {
      const result = this.runApiWrapper(wrapper, creep)

      if (failed !== true && result === "failed") {
        failed = true
      }
    })

    if (failed === true) {
      return TaskProgressType.FinishedAndRan
    }
    return TaskProgressType.InProgress
  }

  private runApiWrapper(apiWrapper: AnyCreepApiWrapper, creep: Creep): ContinuousRunApiTaskApiWrapperStatus {
    const result = apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
    case FINISHED_AND_RAN:
      PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${this.constructor.name} ${creep.name} ${creep.pos} at ${roomLink(creep.room.name)} api wrapper ${apiWrapper.constructor.name} execution finished ${result}`)
      return "failed" // このタスクは継続利用を想定しているため失敗扱い

    case IN_PROGRESS:
    case ERR_BUSY:
      return "in_progress"

    case ERR_NOT_IN_RANGE:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_DAMAGED:
    case ERR_PROGRAMMING_ERROR:
      PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${this.constructor.name} ${creep.name} ${creep.pos} at ${roomLink(creep.room.name)} api wrapper ${apiWrapper.constructor.name} execution failed ${result}`)
      return "failed"
    }
  }
}
