// Child Processes
import { ClaimRoomProcess } from "../economy/claim_room/claim_room_process"
import { ClaimRoomDelegate, ClaimRoomProblem } from "../economy/claim_room/delegate"

// Import
import { ProcessDependencies, ProcessId } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ApplicationProcess } from "os_v5/process/application_process"
import { SemanticVersion } from "shared/utility/semantic_version"


export type EventDrivenTestProcessApi = {
  //
}
type Api = EventDrivenTestProcessApi & ClaimRoomDelegate

type EventDrivenTestProcessState = {
  readonly id: string   // Identifier
}

ProcessDecoder.register("EventDrivenTestProcess", (processId: EventDrivenTestProcessId, state: EventDrivenTestProcessState) => EventDrivenTestProcess.decode(processId, state))

export type EventDrivenTestProcessId = ProcessId<void, string, Api, EventDrivenTestProcessState, EventDrivenTestProcess>


export class EventDrivenTestProcess extends ApplicationProcess<void, string, Api, EventDrivenTestProcessState, EventDrivenTestProcess> {
  public readonly applicationName = "EventDrivenTest"
  public readonly version = new SemanticVersion(1, 0, 0)

  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private constructor(
    public readonly processId: EventDrivenTestProcessId,
    public readonly identifier: string,
  ) {
    super()
  }

  public encode(): EventDrivenTestProcessState {
    return {
      id: this.identifier,
    }
  }

  public static decode(processId: EventDrivenTestProcessId, state: EventDrivenTestProcessState): EventDrivenTestProcess {
    return new EventDrivenTestProcess(processId, state.id)
  }

  public static create(processId: EventDrivenTestProcessId, name: string): EventDrivenTestProcess {
    return new EventDrivenTestProcess(processId, name)
  }

  public getDependentData(): void {
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      this.identifier,
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

  public run(): Api {
    return {
      claimRoomDidFinishClaiming: (process: ClaimRoomProcess): void => {
      },

      claimRoomDidFailClaiming: (process: ClaimRoomProcess, problem: ClaimRoomProblem): void => {
      },
    }
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
