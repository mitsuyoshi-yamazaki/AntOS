import { Process, processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { AnyV5Creep, V5Creep, V5CreepMemoryReservedProperties } from "os_v5/utility/game_object/creep"
import { EmptySerializable, SerializableObject } from "os_v5/utility/types"
import { CreepTask } from "./creep_task/creep_task"
import { CreepName } from "prototype/creep"
import { CreepDistributorProcessApi } from "./creep_distributor_process"
import { ErrorMapper } from "error_mapper/ErrorMapper"

/**
#
## 概要
- Creepの状態遷移によるタスク管理を行う
- Creepの管理ProcessはこのProcessにCreep操作を委譲して行う

## 要件
- 状態遷移によるタスク管理を行う
- タスクの開始、終了時にはCreepの管理Processに通知される
- Creep側で高度な判断は行わず、タスクの状態のみに従って行動する

## Discussion
- 入れ子の子タスクはserializeしたままで、遷移時にdeserializeすればdeserialize時間を短縮できないか
 */

ProcessDecoder.register("CreepTaskStateManagementProcess", (processId: CreepTaskStateManagementProcessId) => CreepTaskStateManagementProcess.decode(processId))

export type TaskDrivenCreepMemory<Roles> = {
  t: CreepTask.TaskState | null
  r: Roles
  // s?: true  /// CreepTask tが終了した際に次タスクの生成を求めるか  // TODO:
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskDrivenCreepMemoryReservedProperties = V5CreepMemoryReservedProperties | { t: any } | { r: any } | { s: any }

export type TaskDrivenCreep<Roles extends string, M extends SerializableObject> = M extends TaskDrivenCreepMemoryReservedProperties ? never : V5Creep<TaskDrivenCreepMemory<Roles> & M> & {
  task: CreepTask.AnyTask | null
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTaskDrivenCreep = TaskDrivenCreep<string, Record<string, any>>


export type CreepTaskStateManagementProcessApi = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTaskDrivenCreeps<Roles extends string, M extends SerializableObject>(creepsToRegister: AnyV5Creep[]): TaskDrivenCreep<Roles, M>[] /// CreepMemoryにタスク内容を保存・現在の状態に更新
}

export type CreepTaskStateManagementProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, CreepTaskStateManagementProcessApi, EmptySerializable, CreepTaskStateManagementProcess>

type Dependency = CreepDistributorProcessApi


export class CreepTaskStateManagementProcess extends Process<Dependency, ProcessDefaultIdentifier, CreepTaskStateManagementProcessApi, EmptySerializable, CreepTaskStateManagementProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
    ],
  }

  private taskDrivenCreeps: AnyTaskDrivenCreep[] = []
  private readonly creepTaskCache = new Map<CreepName, CreepTask.AnyTask>()

  private constructor(
    public readonly processId: CreepTaskStateManagementProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: CreepTaskStateManagementProcessId): CreepTaskStateManagementProcess {
    return new CreepTaskStateManagementProcess(processId)
  }

  public static create(processId: CreepTaskStateManagementProcessId): CreepTaskStateManagementProcess {
    return new CreepTaskStateManagementProcess(processId)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): CreepTaskStateManagementProcessApi {
    this.taskDrivenCreeps = []

    dependency.getDeadCreeps().forEach(deadCreepName => {
      if (this.creepTaskCache.has(deadCreepName) !== true) {
        return
      }
      this.creepTaskCache.delete(deadCreepName)
    })


    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registerTaskDrivenCreeps: <Roles extends string, MemoryExtension extends Record<string, any>>(creepsToRegister: AnyV5Creep[]): TaskDrivenCreep<Roles, MemoryExtension>[] => {
        const creeps = creepsToRegister as TaskDrivenCreep<Roles, MemoryExtension>[]
        creeps.forEach(creep => {
          creep.task = this.parseRootTask(creep) // TODO: タスクをキャッシュ
          this.taskDrivenCreeps.push(creep)
        })

        return creeps
      },
    }
  }

  public runAfterTick(): void {
    this.taskDrivenCreeps.forEach(creep => {
      this.runCreepTask(creep)
    })

    this.taskDrivenCreeps.forEach(creep => {
      if (creep.task == null) {
        creep.memory.t = null
        return
      }
      creep.memory.t = creep.task.encode()
    })
  }

  // Private
  private runCreepTask(creep: AnyTaskDrivenCreep): void {
    if (creep.task == null) {
      return
    }
    const task = creep.task

    ErrorMapper.wrapLoop((): void => {
      const result = task.run(creep)
      switch (result) {
      case "in progress":
        break
      case "finished":
      case "failed":
        creep.task = null
        break
      default:
        creep.task = result
        if (result.canRun(creep) === true) {
          this.runCreepTask(creep)
        }
        break
      }
    }, `CreepTaskStateManagementProcess.runCreepTask(${task.constructor.name}) for creep ${creep.name}`)()
  }

  private parseRootTask(creep: AnyTaskDrivenCreep): CreepTask.AnyTask | null {
    if (creep.memory.t == null) {
      return null
    }
    const taskState = creep.memory.t
    return ErrorMapper.wrapLoop((): CreepTask.AnyTask | null => {
      return CreepTask.decode(taskState)
    }, `CreepTaskStateManagementProcess.parseRootTask(${taskState.t}) for creep ${creep.name}`)()
  }
}
