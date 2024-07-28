import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"

type Dependency = void

type TemplateProcessState = {
  //
}

ProcessDecoder.register("TemplateProcess", (processId: TemplateProcessId, state: TemplateProcessState) => TemplateProcess.decode(processId, state))

export type TemplateProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, void, TemplateProcessState, TemplateProcess>


export class TemplateProcess extends Process<Dependency, ProcessDefaultIdentifier, void, TemplateProcessState, TemplateProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private constructor(
    public readonly processId: TemplateProcessId,
  ) {
    super()
  }

  public encode(): TemplateProcessState {
    return {
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(processId: TemplateProcessId, state: TemplateProcessState): TemplateProcess {
    return new TemplateProcess(processId)
  }

  public static create(processId: TemplateProcessId): TemplateProcess {
    return new TemplateProcess(processId)
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

  public run(): void {
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
