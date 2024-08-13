// Child Processes
import { DetectNukeProcess, DetectNukeProcessId } from "../combat/defence/detect_nuke_process"
import { SellExcessResourceProcess, SellExcessResourceProcessId } from "../economy/trade/sell_excess_resource_process"

// Import
import { BotSpecifier, ProcessDefaultIdentifier, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { V3BridgeDriverProcessApi } from "../v3_os_bridge/v3_bridge_driver_process"
import { SystemCalls } from "os_v5/system_calls/interface"
import { BotApi } from "./types"
import { ApplicationProcess } from "os_v5/process/application_process"
import { SemanticVersion } from "shared/utility/semantic_version"
import { MyRoom } from "shared/utility/room"

type Dependency = V3BridgeDriverProcessApi

type V3BridgeBotProcessApi = BotApi & {
  //
}

type V3BridgeBotProcessState = {
  //
}

ProcessDecoder.register("V3BridgeBotProcess", (processId: V3BridgeBotProcessId, state: V3BridgeBotProcessState) => V3BridgeBotProcess.decode(processId, state))

export type V3BridgeBotProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, V3BridgeBotProcessApi, V3BridgeBotProcessState, V3BridgeBotProcess>


export class V3BridgeBotProcess extends ApplicationProcess<Dependency, ProcessDefaultIdentifier, V3BridgeBotProcessApi, V3BridgeBotProcessState, V3BridgeBotProcess> {
  public readonly applicationName = "V3Bridge"
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeDriverProcess", identifier: processDefaultIdentifier },
    ],
  }

  public readonly version = new SemanticVersion(1, 0, 0)
  private readonly childProcessIdentifier: string

  private constructor(
    public readonly processId: V3BridgeBotProcessId,
  ) {
    super()

    this.childProcessIdentifier = `${this.applicationName}.${this.identifier}`
  }

  public encode(): V3BridgeBotProcessState {
    return {
    }
  }

  public static decode(processId: V3BridgeBotProcessId, state: V3BridgeBotProcessState): V3BridgeBotProcess {
    return new V3BridgeBotProcess(processId)
  }

  public static create(processId: V3BridgeBotProcessId): V3BridgeBotProcess {
    return new V3BridgeBotProcess(processId)
  }

  public didAdd(state: "added" | "restored"): void {
    const specifier: BotSpecifier = { processType: "V3BridgeBotProcess", identifier: this.identifier }

    switch (state) {
    case "added":
      // launched
      SystemCalls.processManager.addProcess((processId: DetectNukeProcessId) => DetectNukeProcess.create(processId, this.childProcessIdentifier, specifier))
      SystemCalls.processManager.addProcess((processId: SellExcessResourceProcessId) => SellExcessResourceProcess.create(processId, this.childProcessIdentifier, specifier))
      break

    case "restored":
      // migration
      if (SystemCalls.processManager.getProcessByIdentifier("SellExcessResourceProcess", this.childProcessIdentifier) == null) {
        SystemCalls.processManager.addProcess((processId: SellExcessResourceProcessId) => SellExcessResourceProcess.create(processId, this.childProcessIdentifier, specifier))
      }
      break

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = state
      break
    }
    }
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
    ]

    return descriptions.join(", ")
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

  public run(dependency: Dependency): V3BridgeBotProcessApi {
    return {
      botInfo: {
        name: this.applicationName,
        identifier: this.identifier,
        version: this.version,
      },

      getManagingRooms: (): MyRoom[] => {
        return this.getV3Rooms(dependency)
      },
    }
  }


  // ---- Private ---- //
  private getV3Rooms(dependency: Dependency): MyRoom[] {
    return dependency.getOwnedRoomResources().map(roomResource => roomResource.room)
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
