import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ProcessDefaultIdentifier } from "os_v5/process/process"
import { EmptySerializable } from "os_v5/utility/types"


export type TerrainCacheProcessApi = {
  //
}


ProcessDecoder.register("TerrainCacheProcess", (processId: TerrainCacheProcessId) => TerrainCacheProcess.decode(processId))

export type TerrainCacheProcessId = ProcessId<void, ProcessDefaultIdentifier, TerrainCacheProcessApi, EmptySerializable, TerrainCacheProcess>


export class TerrainCacheProcess extends Process<void, ProcessDefaultIdentifier, TerrainCacheProcessApi, EmptySerializable, TerrainCacheProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
    ],
  }

  private constructor(
    public readonly processId: TerrainCacheProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: TerrainCacheProcessId): TerrainCacheProcess {
    return new TerrainCacheProcess(processId)
  }

  public static create(processId: TerrainCacheProcessId): TerrainCacheProcess {
    return new TerrainCacheProcess(processId)
  }

  public getDependentData(): void {}

  public staticDescription(): string {
    return "TODO"
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): TerrainCacheProcessApi {
    return {
    }
  }
}
