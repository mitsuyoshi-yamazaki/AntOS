// Child Processes
import { ClaimRoomProcess, ClaimRoomProcessId } from "../economy/claim_room/claim_room_process"
import { ClaimRoomDelegate, ClaimRoomProblem } from "../economy/claim_room/delegate"
import {} from "../combat/scouting/scout_room_process"
import { RoomKeeperProcess, RoomKeeperProcessId } from "../economy/room_keeper/room_keeper_process"
import { RoomKeeperDelegate, RoomKeeperProblem } from "../economy/room_keeper/delegate"

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
import { MyRoom } from "shared/utility/room"


// Game.v5.io("launch EventDrivenTestProcess name=E53N50-no-ctrl parent_room_name=E53N53 child_process_type=ClaimRoomProcess target_room_name=E53N50 -l")
// Game.v5.io("launch EventDrivenTestProcess name=E55N53-keeper parent_room_name=E53N53 child_process_type=RoomKeeperProcess target_room_name=E55N53 -l")


const eventDrivenTestChildProcessTypes = [
  "ClaimRoomProcess",
  "RoomKeeperProcess",
] as const
export type EventDrivenTestChildProcessTypes = typeof eventDrivenTestChildProcessTypes[number]
export const isEventDrivenTestChildProcessTypes = (value: string): value is EventDrivenTestChildProcessTypes => (eventDrivenTestChildProcessTypes as Readonly<string[]>).includes(value)


export type EventDrivenTestProcessApi = {
  //
}
type Api = EventDrivenTestProcessApi & ClaimRoomDelegate & RoomKeeperDelegate


type ChildProcessArgumentsClaimRoom = {
  readonly case: "cr"
  readonly r: RoomName
}
type ChildProcessArgumentsRoomKeeper = {
  readonly case: "rk"
  readonly r: RoomName
  readonly ws: number   /// Worker size
  readonly wc: number   /// Worker count
}
export type ChildProcessArguments = ChildProcessArgumentsClaimRoom | ChildProcessArgumentsRoomKeeper


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
  public readonly version = new SemanticVersion(1, 0, 5)

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

    const parentRoom = Game.rooms[this.parentRoomName]
    const requestArbitaryCreep: <M extends SerializableObject>(roomName: RoomName, requestMaker: (energyCapacity: number) => CreepRequest<M>) => void = parentRoom == null ? () => undefined : (roomName, requestMaker) => {
      const request = requestMaker(parentRoom.energyCapacityAvailable)
      dependency.addSpawnRequestV3(
        request.processId,
        request.requestIdentifier,
        request.body,
        this.parentRoomName,
        request.options,
      )
    }

    return {
      requestFixedCreep: <M extends SerializableObject>(request: CreepRequest<M>): void => {
        dependency.addSpawnRequestV3(
          request.processId,
          request.requestIdentifier,
          request.body,
          this.parentRoomName,
          request.options,
        )
      },

      requestArbitaryCreep,

      // ---- ClaimRoomProcess ---- //
      claimRoomDidFinishClaiming: (process: ClaimRoomProcess): void => {
        SystemCalls.logger.log(this, `claimRoomDidFinishClaiming: ${ConsoleUtility.roomLink(process.roomName)}`)

        this.childProcessState = {
          case: "finished",
          t: Game.time,
        }
      },

      claimRoomDidFailClaiming: (process: ClaimRoomProcess, problem: ClaimRoomProblem): void => {
        const problemDescription = ((): string => {
          switch (problem.case) {
          case "claim_failed":
            return `[claim_failed] ${problem.reason}`
          case "controller_unreachable":
            return "[controller_unreachable]"
          case "creep_attacked":
            return "[creep_attacked]"
          case "room_unreachable":
            return `[room_unreachable] ${ConsoleUtility.roomLink(problem.blockingRoomName)}`
          case "unknown":
            return `[unknown] ${problem.reason}`
          }
        })()
        SystemCalls.logger.log(this, `claimRoomDidFailClaiming: ${ConsoleUtility.roomLink(process.roomName)}, ${problemDescription}`)

        this.childProcessState = {
          case: "failed",
          reason: `${ConsoleUtility.roomLink(process.roomName)}: ${problemDescription}`,
          t: Game.time,
        }
      },

      // ---- RoomKeeperProcess ---- //
      roomKeeperDidRaiseProblem: (process: RoomKeeperProcess, problem: RoomKeeperProblem): void => {
        // TODO:
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
        case "rk":
          return RoomKeeperProcess.create(processId as RoomKeeperProcessId, childProcessArguments.r, specifier, childProcessArguments.wc, childProcessArguments.ws)
        }
      })

      SystemCalls.logger.log(this, `Launched ${process}`)

      return {
        case: "running",
        p: process.processId as AnyProcessId,
      }

    } catch (error) {
      const processType = ((): EventDrivenTestChildProcessTypes => {
        switch (childProcessArguments.case) {
        case "cr":
          return "ClaimRoomProcess"
        case "rk":
          return "RoomKeeperProcess"
        }
      })()

      SystemCalls.logger.log(this, `Launch ${processType} failed: ${error}`)

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
        "- " + ConsoleUtility.colored(`${this.version}`, "white"),
        `- ${ConsoleUtility.colored(this.identifier, "white")}`,
        `- Child process state: ${stateDescription}`,
      ]

      return descriptions.join("\n")
    }
  }
}
