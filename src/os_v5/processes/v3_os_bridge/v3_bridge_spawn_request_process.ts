import { Process, ProcessDependencies, ProcessId } from "../../process/process"
import { shortenedNumber } from "shared/utility/console_utility"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"

// SpawnPoolのライフサイクルはv3 OSのライフサイクル内で閉じているので、直接Spawn APIを呼び出す

type V3BridgeSpawnRequestProcessState = {
}

ProcessDecoder.register("V3BridgeSpawnRequestProcess", (processId: V3BridgeSpawnRequestProcessId, state: V3BridgeSpawnRequestProcessState) => V3BridgeSpawnRequestProcess.decode(processId, state))

export type V3BridgeSpawnRequestProcessId = ProcessId<void, "V3SpawnRequest", void, V3BridgeSpawnRequestProcessState, V3BridgeSpawnRequestProcess>


export class V3BridgeSpawnRequestProcess implements Process<void, "V3SpawnRequest", void, V3BridgeSpawnRequestProcessState, V3BridgeSpawnRequestProcess> {
  public readonly identifier = "V3SpawnRequest"
  public readonly dependencies: ProcessDependencies = {
    driverNames: [],
    processes: [],
  }

  private constructor(
    public readonly processId: V3BridgeSpawnRequestProcessId,
  ) {
  }

  public encode(): V3BridgeSpawnRequestProcessState {
    return {
    }
  }

  public static decode(processId: V3BridgeSpawnRequestProcessId, state: V3BridgeSpawnRequestProcessState): V3BridgeSpawnRequestProcess {
    return new V3BridgeSpawnRequestProcess(processId)
  }

  public static create(processId: V3BridgeSpawnRequestProcessId): V3BridgeSpawnRequestProcess {
    return new V3BridgeSpawnRequestProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return `launched at ${this.launchTime} (${shortenedNumber(Game.time - this.launchTime)})`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
  }
}
