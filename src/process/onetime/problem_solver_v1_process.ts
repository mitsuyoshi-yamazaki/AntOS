import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("ProblemSolverV1Process", state => {
  return ProblemSolverV1Process.decode(state as ProblemSolverV1ProcessState)
})

export namespace ProblemSolverV1 {
  /**
   * - 階層化可能な状態にする
   * - 最終的に具体化した問題はAPIのレベルになる？
   * - Testは実行可能
   */
  export type Problem = {
    readonly solutions: Solution[]
    readonly description: string
  }

  export type Solution = {
    readonly tests: Test[]
  }

  export type Task = {
    readonly results: TaskResult[]
  }

  export type Test = {
    readonly tasks: Task[]
  }

  export type TaskResult = {
    readonly description: string
  }

  export const createTestProblem = (): Problem => {
    const description = "Maximize energy income"

    return {
      solutions: [],
      description,
    }
  }
}

type Problem = ProblemSolverV1.Problem

export interface ProblemSolverV1ProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly problem: Problem
}

/**
 * - Solutionの検証を行うProcess
 * - Problem, Solutionの作成はProblemSolverV1が行う
 */
export class ProblemSolverV1Process implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly problem: Problem,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): ProblemSolverV1ProcessState {
    return {
      t: "ProblemSolverV1Process",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      problem: this.problem,
    }
  }

  public static decode(state: ProblemSolverV1ProcessState): ProblemSolverV1Process {
    return new ProblemSolverV1Process(state.l, state.i, state.roomName, state.problem)
  }

  public static create(processId: ProcessId, roomName: RoomName, problem: Problem): ProblemSolverV1Process {
    return new ProblemSolverV1Process(Game.time, processId, roomName, problem)
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)} ${this.problem.description}`
  }

  public runOnTick(): void {

  }
}
