import { createObjectives, isLaunchableObjectiveType, LaunchableObjectiveType, Objective } from "objective/objective"
import { Problem, ProblemIdentifier } from "objective/problem"
import { decodeProblemSolvers, ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunner } from "objective/task_runner"
import { UpgradeControllerObjective } from "objective/upgrade_controller/upgrade_controller_objective"
import { Procedural } from "old_objective/procedural"
import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId, processLog, ProcessState } from "process/process"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"

export interface ObjectiveProcessState extends ProcessState {
  /** objective types */
  o: LaunchableObjectiveType[]

  /** problem solver state */
  s: ProblemSolverState[]

  /** room name */
  r: RoomName
}

export class ObjectiveProcess implements Process, Procedural, MessageObserver {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objectiveTypes: LaunchableObjectiveType[],
    private problemSolvers: ProblemSolver[],
    public readonly roomName: RoomName,
  ) {
  }

  public encode(): ObjectiveProcessState {
    return {
      t: "ObjectiveProcess",
      l: this.launchTime,
      i: this.processId,
      o: this.objectiveTypes,
      s: this.problemSolvers.map(solver => solver.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: ObjectiveProcessState): ObjectiveProcess {
    const problemSolvers = decodeProblemSolvers(state.s)
    return new ObjectiveProcess(state.l, state.i, state.o, problemSolvers, state.r)
  }

  public static create(processId: ProcessId, roomName: RoomName): ObjectiveProcess {
    return new ObjectiveProcess(Game.time, processId, [], [], roomName)
  }

  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  public runOnTick(): void {
    const objectives = this.objectives()
    const [taskRunners, problems] = this.taskRunnersOf(objectives)

    if (problems.length <= 0) {
      this.problemSolvers = []
      processLog(this, `Room ${roomLink(this.roomName)} working fine 😀`)
    } else {
      this.updateProblemSolvers(problems)
    }

    // TODO: taskRunnersとも重複を除く
    this.runTasks(taskRunners, this.problemSolvers)
  }

  private objectives(): Objective[] {
    const objects = World.rooms.getOwnedRoomObjects(this.roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`Room ${roomLink(this.roomName)} lost`)
      return []
    }

    const result: Objective[] = [new UpgradeControllerObjective(objects)]
    result.push(...createObjectives(this.objectiveTypes, objects))
    return result
  }

  private taskRunnersOf(objectives: Objective[]): [TaskRunner[], Problem[]] {
    const taskRunners: TaskRunner[] = []
    const problems: Problem[] = []

    objectives.forEach(objective => {
      taskRunners.push(...objective.taskRunners())
      const status = objective.currentStatus()
      switch (status.objectiveStatus) {
      case "achieved":
        break
      case "not achieved":
        problems.push(...status.problems)
        break
      }
    })
    return [taskRunners, problems]
  }

  private updateProblemSolvers(currentProblems: Problem[]): void {
    const problemMap = new Map<ProblemIdentifier, Problem>()
    currentProblems.forEach(problem => {
      problemMap.set(problem.identifier, problem)
    })

    // 解決した問題をフィルタ
    const allProblemIdentifiers = Array.from(problemMap.values()).map(problem => problem.identifier)
    this.problemSolvers = this.problemSolvers.filter(solver => allProblemIdentifiers.includes(solver.problemIdentifier))

    // 現在実行中の問題をフィルタ
    this.problemSolvers.forEach(solver => problemMap.delete(solver.problemIdentifier))

    Array.from(problemMap.values()).forEach(problem => {
      const solvers = problem.getProblemSolvers()
      if (solvers[0] == null) {
        PrimitiveLogger.fatal(`HELP! problem ${problem.identifier} has no solutions`)
        return
      }
      this.problemSolvers.push(solvers[0])    // TODO: 選択する
    })
  }

  private runTasks(taskRunners: TaskRunner[], problemSolvers: ProblemSolver[]): void {
    taskRunners.forEach(taskRunner => taskRunner.run())

    if (problemSolvers.length <= 0) {
      return
    }
    processLog(this, `Room ${roomLink(this.roomName)} has following problems:\n  - ${problemSolvers.map(p => p.problemIdentifier).join("\n  - ")}`)
    problemSolvers.forEach(solver => solver.run())
  }

  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    if (components.length < 2) {
      return `Invalid arguments: <add | remove> <objective type>, (${message})`
    }

    const objectiveType = components[1]
    if (!isLaunchableObjectiveType(objectiveType)) {
      return `Invalid objective type ${objectiveType}`
    }

    switch (components[0]) {
    case "add":
      this.objectiveTypes.push(objectiveType)
      return `Added ${objectiveType}`
    case "remove": {
      const index = this.objectiveTypes.indexOf(objectiveType)
      if (index < 0) {
        return `Invalid objective type ${objectiveType} is not in the list. Registered objective types: ${this.objectiveTypes}`
      }
      this.objectiveTypes.splice(index, 1)
      return `Removed ${objectiveType}`
    }
    default:
      return `Invalid command ${components[0]}, available commands: add, remove`
    }
  }
}
