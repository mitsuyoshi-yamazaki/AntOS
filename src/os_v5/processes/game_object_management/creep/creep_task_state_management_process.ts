import { Process, ProcessDependencies, ProcessId } from "../../../process/process"
import { shortenedNumber } from "shared/utility/console_utility"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"

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

ProcessDecoder.register("CreepTaskStateManagementProcess", (processId: CreepTaskStateManagementProcessId, state: CreepTaskStateManagementProcessState) => CreepTaskStateManagementProcess.decode(processId, state))


export type CreepTaskStateManagementProcessApi = {
}

type CreepTaskStateManagementProcessState = {
}

export type CreepTaskStateManagementProcessId = ProcessId<void, "CreepTaskStateManagement", CreepTaskStateManagementProcessApi, CreepTaskStateManagementProcessState, CreepTaskStateManagementProcess>


export class CreepTaskStateManagementProcess extends Process<void, "CreepTaskStateManagement", CreepTaskStateManagementProcessApi, CreepTaskStateManagementProcessState, CreepTaskStateManagementProcess> {
  public readonly identifier = "CreepTaskStateManagement"
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: CreepTaskStateManagementProcessId,
  ) {
    super()
  }

  public encode(): CreepTaskStateManagementProcessState {
    return {
    }
  }

  public static decode(processId: CreepTaskStateManagementProcessId, state: CreepTaskStateManagementProcessState): CreepTaskStateManagementProcess {
    return new CreepTaskStateManagementProcess(processId)
  }

  public static create(processId: CreepTaskStateManagementProcessId, identifier: string): CreepTaskStateManagementProcess {
    return new CreepTaskStateManagementProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return `launched at ${this.launchTime} (${shortenedNumber(Game.time - this.launchTime)})`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): CreepTaskStateManagementProcessApi {
    return {
    }
  }

  public runAfterTick(): void {
  }
}
