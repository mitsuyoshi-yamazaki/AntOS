import { createObjectives, isLaunchableObjectiveType, LaunchableObjectiveType, Objective } from "objective/objective"
import { Problem, ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunner } from "objective/task_runner"
import { Procedural } from "old_objective/procedural"
import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { State, Stateful } from "os/infrastructure/state"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"

export interface ObjectiveRunnerState extends State {
  /** objective types */
  o: LaunchableObjectiveType[]

  /** problem solver state */
  s: ProblemSolverState[]

  /** room name */
  r: RoomName
}

export interface ObjectiveRunner {
  didListupObjectives?(objectives: Objective[]): void
  didListupTaskRunners?(taskRunners: TaskRunner[]): void
  didResolveProblems?(resolvedProblemSolvers: ProblemSolver[]): void
  didOccurProblems?(newProblems: Problem[]): void
  chooseProblemSolver?(problem: Problem): ProblemSolver | null
}

export abstract class ObjectiveRunner implements Stateful, Procedural, MessageObserver {
  protected constructor(
    protected readonly objectiveTypes: LaunchableObjectiveType[],
    protected problemSolvers: ProblemSolver[],
    public readonly roomName: RoomName,
  ) {
  }

  // ---- Subclassing APIs ---- //
  // see also: ObjectiveRunner interface
  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  abstract encode(): ObjectiveRunnerState
  abstract log(message: string): void

  // ---- Functions ---- //
  public runOnTick(): void {
    const objectives = this.listupObjectives()
    if (objectives.length <= 0) {
      this.log("No objectives")
    }

    if (this.didListupObjectives != null) {
      this.didListupObjectives(objectives)
    }

    const taskRunners = objectives.flatMap(objective => objective.taskRunners())
    const problems = objectives.flatMap(objective => objective.currentProblems())

    if (this.didListupTaskRunners != null) {
      this.didListupTaskRunners(taskRunners)
    }

    const problemIdentifiers = problems.map(problem => problem.identifier)
    const solvingProblemIdentifiers = this.problemSolvers.map(solver => solver.problemIdentifier)
    const resolvedProblemSolvers: ProblemSolver[] = []
    const newProblems: Problem[] = []

    this.problemSolvers.forEach(solver => {
      if (problemIdentifiers.includes(solver.problemIdentifier) !== true) {
        resolvedProblemSolvers.push(solver)
      }
    })

    problems.forEach(problem => {
      if (solvingProblemIdentifiers.includes(problem.identifier) !== true) {
        newProblems.push(problem)
      }
    })

    if (this.didResolveProblems != null) {
      this.didResolveProblems(resolvedProblemSolvers)
    }
    if (this.didOccurProblems != null) {
      this.didOccurProblems(newProblems)
    }

    this.problemSolvers = this.problemSolvers.filter(solver => resolvedProblemSolvers.includes(solver) !== true)
    newProblems.forEach(problem => {
      if (this.chooseProblemSolver != null) {
        const solver = this.chooseProblemSolver(problem)
        if (solver != null) {
          this.problemSolvers.push(solver)
          return
        }
      }

      const problemSolvers = problem.getProblemSolvers()
      if (problemSolvers[0] != null) {
        this.problemSolvers.push(problemSolvers[0])
      } else {
        this.log(`Problem ${problem.identifier} has no solver`)
      }
    })

    // TODO: taskRunnersとも重複を除く
    taskRunners.forEach(taskRunner => taskRunner.run())
    this.problemSolvers.forEach(solver => solver.run())
  }

  private listupObjectives(): Objective[] {
    const objects = World.rooms.getOwnedRoomObjects(this.roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`Room ${roomLink(this.roomName)} seems to be lost`)
      return []
    }

    return createObjectives(this.objectiveTypes, objects)
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
