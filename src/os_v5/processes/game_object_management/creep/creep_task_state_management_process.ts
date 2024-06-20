import { AnyProcessId, Process, ProcessDependencies, ProcessId } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { V5Creep } from "os_v5/utility/game_object/creep"
import { EmptySerializable } from "os_v5/utility/types"

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

type V5StateTaskCreepMemory = {
  //
}
export type V5StateTaskCreep = V5Creep<V5StateTaskCreepMemory> & {
  //
}

export type CreepTaskStateManagementProcessApi = {
  getStandByCreepsFor(processId: AnyProcessId): V5StateTaskCreep[]
  getCreepsFor(processId: AnyProcessId): V5StateTaskCreep[]
}

export type CreepTaskStateManagementProcessId = ProcessId<void, "CreepTaskStateManagement", CreepTaskStateManagementProcessApi, EmptySerializable, CreepTaskStateManagementProcess>


export class CreepTaskStateManagementProcess extends Process<void, "CreepTaskStateManagement", CreepTaskStateManagementProcessApi, EmptySerializable, CreepTaskStateManagementProcess> {
  public readonly identifier = "CreepTaskStateManagement"
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

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

  public getDependentData(): void { }

  public staticDescription(): string {
    return "TODO"
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): CreepTaskStateManagementProcessApi {
    return {
      getStandByCreepsFor: (processId: AnyProcessId): V5StateTaskCreep[] => [], // TODO:
      getCreepsFor: (processId: AnyProcessId): V5StateTaskCreep[] => [], // TODO:
    }
  }

  public runAfterTick(): void {
  }
}
