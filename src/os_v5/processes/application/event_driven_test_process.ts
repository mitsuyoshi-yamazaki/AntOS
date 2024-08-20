// Child Processes
import { ClaimRoomProcess, ClaimRoomProcessId } from "../economy/claim_room/claim_room_process"
import { ClaimRoomDelegate, ClaimRoomProblem } from "../economy/claim_room/delegate"

// Import
import { AnyProcessId, processDefaultIdentifier, ProcessDependencies, ProcessId, ProcessSpecifier, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ApplicationProcess } from "os_v5/process/application_process"
import { SemanticVersion } from "shared/utility/semantic_version"
import { SerializableObject } from "shared/utility/serializable_types"
import { CreepRequest } from "../bot/creep_provider_api"
import { Timestamp } from "shared/utility/timestamp"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { RoomName } from "shared/utility/room_name_types"
import { SystemCalls } from "os_v5/system_calls/interface"


const eventDrivenTestChildProcessTypes = [
  "ClaimRoomProcess",
] as const
export type EventDrivenTestChildProcessTypes = typeof eventDrivenTestChildProcessTypes[number]
export const isEventDrivenTestChildProcessTypes = (value: string): value is EventDrivenTestChildProcessTypes => (eventDrivenTestChildProcessTypes as Readonly<string[]>).includes(value)


export type EventDrivenTestProcessApi = {
  //
}
type Api = EventDrivenTestProcessApi & ClaimRoomDelegate


type ChildProcessArgumentsClaimRoom = {
  readonly case: "cr"
  readonly r: RoomName
}
export type ChildProcessArguments = ChildProcessArgumentsClaimRoom


type ChildProcessStateInit = {
  readonly case: "init"
  readonly a: ChildProcessArguments
}
type ChildProcessStateRunning = {
  readonly case: "running"
  readonly p: AnyProcessId
}
type ChildProcessStateFinished = {
  readonly case: "finished"
  readonly t: Timestamp
}
type ChildProcessStateFailed = {
  readonly case: "failed"
  readonly reason: string
  readonly t: Timestamp
}
type ChildProcessState = ChildProcessStateInit | ChildProcessStateRunning | ChildProcessStateFinished | ChildProcessStateFailed


type EventDrivenTestProcessState = {
  readonly id: string   /// Identifier
  readonly l: Timestamp /// Launched at
  readonly p: RoomName  /// Parent room name
  readonly s: ChildProcessState
}


type Dependency = V3BridgeSpawnRequestProcessApi


ProcessDecoder.register("EventDrivenTestProcess", (processId: EventDrivenTestProcessId, state: EventDrivenTestProcessState) => EventDrivenTestProcess.decode(processId, state))

export type EventDrivenTestProcessId = ProcessId<Dependency, string, Api, EventDrivenTestProcessState, EventDrivenTestProcess>


export class EventDrivenTestProcess extends ApplicationProcess<Dependency, string, Api, EventDrivenTestProcessState, EventDrivenTestProcess> {
  public readonly applicationName = "EventDrivenTest"
  public readonly version = new SemanticVersion(1, 0, 1)

  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
    ],
  }

  private constructor(
    public readonly processId: EventDrivenTestProcessId,
    public readonly identifier: string,
    private readonly launchedAt: Timestamp,
    private readonly parentRoomName: RoomName,
    private childProcessState: ChildProcessState,
  ) {
    super()
  }

  public encode(): EventDrivenTestProcessState {
    return {
      id: this.identifier,
      l: this.launchedAt,
      p: this.parentRoomName,
      s: this.childProcessState,
    }
  }

  public static decode(processId: EventDrivenTestProcessId, state: EventDrivenTestProcessState): EventDrivenTestProcess {
    return new EventDrivenTestProcess(processId, state.id, state.l, state.p, state.s)
  }

  public static create(
    processId: EventDrivenTestProcessId,
    name: string,
    parentRoomName: RoomName,
    childProcessArguments: ChildProcessArguments,
  ): EventDrivenTestProcess {

    const initialState: ChildProcessStateInit = {
      case: "init",
      a: childProcessArguments,
    }
    return new EventDrivenTestProcess(processId, name, Game.time, parentRoomName, initialState)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const stateDescription = ((): string | null => {
      switch (this.childProcessState.case) {
      case "init":
        return null
      case "running":
        return `running (ID: ${this.childProcessState.p})`
      case "finished":
        return "finished"
      case "failed":
        return "failed"
      }
    })()

    const descriptions: string[] = [
      ConsoleUtility.colored(`${this.version}`, "white"),
      ConsoleUtility.colored(this.identifier, "white"),
    ]
    if (stateDescription != null) {
      descriptions.push(stateDescription)
    }

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.statusCommand,
    ])
  }

  public run(dependency: Dependency): Api {
    this.transitionState()

    return {
      requestCreep: <M extends SerializableObject>(request: CreepRequest<M>): void => {
        dependency.addSpawnRequestV3(
          request.processId,
          request.requestIdentifier,
          request.body,
          this.parentRoomName,
          request.options,
        )
      },

      claimRoomDidFinishClaiming: (process: ClaimRoomProcess): void => {
      },

      claimRoomDidFailClaiming: (process: ClaimRoomProcess, problem: ClaimRoomProblem): void => {
      },
    }
  }


  // ---- Private ---- //
  private transitionState(): void {
    switch (this.childProcessState.case) {
    case "init":
      this.childProcessState = this.launchChildProcess(this.childProcessState.a)
      return

    case "running":
    case "finished":
    case "failed":
      return

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.childProcessState
      return
    }
    }
  }

  private launchChildProcess(childProcessArguments: ChildProcessArguments): ChildProcessStateRunning | ChildProcessStateFailed {
    const specifier: ProcessSpecifier = {
      processType: "EventDrivenTestProcess",
      identifier: this.identifier,
    }

    try {
      const process = SystemCalls.processManager.addProcess(processId => {
        switch (childProcessArguments.case) {
        case "cr":
          return ClaimRoomProcess.create(processId as ClaimRoomProcessId, childProcessArguments.r, specifier)
        }
      })

      return {
        case: "running",
        p: process.processId as AnyProcessId,
      }

    } catch (error) {
      const processType = ((): EventDrivenTestChildProcessTypes => {
        switch (childProcessArguments.case) {
        case "cr":
          return "ClaimRoomProcess"
        }
      })()

      return {
        case: "failed",
        reason: `Launching ${processType} failed with: ${error}`,
        t: Game.time,
      }
    }
  }


  // ---- Command Runner ---- //
  private readonly statusCommand: Command = {
    command: "status",
    help: (): string => "status",

    /** @throws */
    run: (): string => {
      const stateDescription = ((): string => {
        switch (this.childProcessState.case) {
        case "init":
          return "not launched"
        case "running":
          return `running (ID: ${this.childProcessState.p})`
        case "finished":
          return "finished"
        case "failed":
          return `failed at ${ConsoleUtility.shortenedNumber(Game.time - this.childProcessState.t)} ticks ago (${this.childProcessState.reason})`
        }
      })()

      const descriptions: string[] = [
        `- ${ConsoleUtility.colored(this.identifier, "white")}`,
        `- Child process state: ${stateDescription}`,
      ]

      return descriptions.join("\n")
    }
  }
}
