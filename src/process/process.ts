import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { TestProcess, TestProcessState } from "./test_process"

export type ProcessId = number

export interface ProcessState extends State {
  /** type identifier */
  t: keyof ProcessTypes

  /** launch time */
  l: number

  /** process ID */
  i: number
}

export interface Process extends Stateful {
  launchTime: number
  processId: ProcessId

  processDescription?(): string
  encode(): ProcessState
}

// ---- Type of Execution ---- //
export interface Procedural {
  runOnTick(): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isProcedural(arg: any): arg is Procedural {
  return arg.runOnTick !== undefined
}

// ---- Example ---- //
class ExampleProcess implements Process { // TODO: 他のProcessを実装したら消す
  public readonly launchTime = 0
  public readonly processId = 0

  public encode(): ProcessState {
    return {
      t: "ExampleProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(state: ProcessState): ExampleProcess | null {
    return null
  }
}

class ProcessTypes {
  "ExampleProcess" = (state: ProcessState) => ExampleProcess.decode(state as ProcessState)
  "TestProcess" = (state: TestProcessState) => TestProcess.decode(state as TestProcessState)
}

export function decodeProcessFrom(state: ProcessState): Process | null {
  let decoded: Process | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new ProcessTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeProcessFrom(), process type: ${state.t}`)()
  return decoded
}
