import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { TerrainCacheProcessApi } from "../../game_object_management/terrain_cache_process"
import { SystemCalls } from "os_v5/system_calls/interface"

type Dependency = TerrainCacheProcessApi

type ManualRoomPlannerProcessState = {
  //
}

ProcessDecoder.register("ManualRoomPlannerProcess", (processId: ManualRoomPlannerProcessId, state: ManualRoomPlannerProcessState) => ManualRoomPlannerProcess.decode(processId, state))

export type ManualRoomPlannerProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, void, ManualRoomPlannerProcessState, ManualRoomPlannerProcess>


export class ManualRoomPlannerProcess extends Process<Dependency, ProcessDefaultIdentifier, void, ManualRoomPlannerProcessState, ManualRoomPlannerProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private constructor(
    public readonly processId: ManualRoomPlannerProcessId,
  ) {
    super()
  }

  public encode(): ManualRoomPlannerProcessState {
    return {
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(processId: ManualRoomPlannerProcessId, state: ManualRoomPlannerProcessState): ManualRoomPlannerProcess {
    return new ManualRoomPlannerProcess(processId)
  }

  public static create(processId: ManualRoomPlannerProcessId): ManualRoomPlannerProcess {
    return new ManualRoomPlannerProcess(processId)
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

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.templateCommand,
    ])
  }

  public run(): void {
    SystemCalls.processManager.suspend(this)
  }


  // ---- Command Runner ---- //
  private readonly templateCommand: Command = {
    command: "template",
    help: (): string => "template {...args}",

    /** @throws */
    run: (): string => {
      return "ok"
    }
  }
}
