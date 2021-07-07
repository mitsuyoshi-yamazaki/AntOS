import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { TargetingApiWrapperTargetType } from "object_task/targeting_api_wrapper"
import { TaskProgressType } from "object_task/object_task"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask, CreepTaskState } from "../creep_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

type RunApisTaskApiWrapperStatus = "finished" | "finished_and_ran" | "in_progress" | "failed"

export interface RunApisTaskOptions {
  /**
   * - ApiWrapperが全て完了するまでこのタスクを終了しない
   *   - trueの場合、完了/失敗したApiWrapperは取り除かれる
   *   - falseの場合、ひとつでも完了したApiWrapperがあればタスクを終了する
   */
  waitUntilFinishedAll: boolean

  // TODO: 全て同時に完了するまで終了しなくなるため無効
  // /** waitUntilFinishedAllがtrueの場合、一度終了したApiWrapperを再度実行する */
  // runFinishedTasks: boolean

  /** falseの場合、ApiWrapperの失敗でequentialTask自体を終了する */
  ignoreFailure: boolean
}

export interface RunApisTaskState extends CreepTaskState {
  /** api warpper states */
  as: CreepApiWrapperState[]

  /** options */
  o: {
    /** waitUntilFinishedAll */
    w: boolean

    /** ignoreFailure */
    i: boolean
  }
}

// TODO: ApiWrapperが並列動作可能な組み合わせかどうかコンパイラがチェックできるようにする
/**
 * - CreepTaskは任意に並列動作できないためApiWrapperに対して行う
 * - 現状ではmove系のApiWrapperがないため静止状態で行えるもののみ：moveしつつ行えるようになったらERR_NOT_IN_RANGEの扱いを変更する必要がある
 */
export class RunApisTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TargetingApiWrapperTargetType> | undefined {
    return undefined  // FixMe: 中途半端に行うとキャッシュにTaskRunnerが残り続けてしまう
  }

  private constructor(
    public readonly startTime: number,
    private readonly apiWrappers: AnyCreepApiWrapper[],
    private readonly options: RunApisTaskOptions,
  ) {
    this.shortDescription = ((): string => {
      const firstWrapper = this.apiWrappers[0]
      if (firstWrapper != null) {
        return `m-${firstWrapper.shortDescription}`
      }
      return "multi"
    })()
  }

  public encode(): RunApisTaskState {
    return {
      s: this.startTime,
      t: "RunApisTask",
      as: this.apiWrappers.map(wrapper => wrapper.encode()),
      o: {
        w: this.options.waitUntilFinishedAll,
        i: this.options.ignoreFailure,
      },
    }
  }

  public static decode(state: RunApisTaskState): RunApisTask | null {
    const wrappers = state.as.flatMap(wrapperState => decodeCreepApiWrapperFromState(wrapperState) ?? [])
    const options: RunApisTaskOptions = {
      waitUntilFinishedAll: state.o.w,
      ignoreFailure: state.o.i,
    }
    return new RunApisTask(state.s, wrappers, options)
  }

  public static create(apiWrappers: AnyCreepApiWrapper[], options: RunApisTaskOptions): RunApisTask {
    return new RunApisTask(Game.time, apiWrappers, options)
  }

  public run(creep: Creep): TaskProgressType {
    const results: RunApisTaskApiWrapperStatus[] = []
    const finishedApiWrappers: AnyCreepApiWrapper[] = []

    this.apiWrappers.forEach(wrapper => {
      const result = this.runApiWrapper(wrapper, creep)
      results.push(result)

      if (result !== "in_progress") {
        finishedApiWrappers.push(wrapper)
      }
    })

    const didRun = results.some(result => result === "finished_and_ran")

    if (this.options.ignoreFailure !== true) {
      if (results.some(result => result === "failed") === true) {
        return didRun ? TaskProgressType.FinishedAndRan : TaskProgressType.Finished
      }
    }

    if (this.options.waitUntilFinishedAll === true) {
      this.removeApiWrappers(finishedApiWrappers)
      if (this.apiWrappers.length > 0) {
        return TaskProgressType.InProgress
      }
      return didRun ? TaskProgressType.FinishedAndRan : TaskProgressType.Finished
    } else {
      if (finishedApiWrappers.length > 0) {
        return didRun ? TaskProgressType.FinishedAndRan : TaskProgressType.Finished
      }
      return TaskProgressType.InProgress
    }
  }

  private runApiWrapper(apiWrapper: AnyCreepApiWrapper, creep: Creep): RunApisTaskApiWrapperStatus {
    const result = apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return "finished"

    case FINISHED_AND_RAN:
      return "finished_and_ran"

    case IN_PROGRESS:
    case ERR_BUSY:
      return "in_progress"

    case ERR_NOT_IN_RANGE:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_DAMAGED:
    case ERR_PROGRAMMING_ERROR:
      return "failed"
    }
  }

  private removeApiWrappers(apiWrappers: AnyCreepApiWrapper[]): void {
    apiWrappers.forEach(wrapper => {
      const index = this.apiWrappers.indexOf(wrapper)
      if (index < 0) {
        PrimitiveLogger.fatal(`RunApisTask.removeWrapper() attempts to remove ApiWrapper ${wrapper.shortDescription} that not in the list`)
        return
      }
      this.apiWrappers.splice(index, 1)
    })
  }
}
