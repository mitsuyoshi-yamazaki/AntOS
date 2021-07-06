import { ProblemIdentifier } from "problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "problem/problem_solver"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { generateCodename } from "utility/unique_id"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepSpawnRequest, CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

export interface CreepInsufficiencyProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName

  /** creep request */
  cr: {
    /** necessary roles */
    r: CreepRole[]

    /** target task identifier */
    t: TaskIdentifier | null

    /** required creep count */
    c: number

    /** codename */
    n: string
  }
}

export class CreepInsufficiencyProblemSolver extends ProblemSolver {
  public codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    private readonly necessaryRoles: CreepRole[],
    private readonly targetTaskIdentifier: TaskIdentifier | null,
    private readonly requiredCreepCount: number,
  ) {
    super(startTime, children, problemIdentifier)

    this.codename = generateCodename(this.constructor.name, this.roomName.split("").reduce((r, c) => r + c.charCodeAt(0), 0))
  }

  public encode(): CreepInsufficiencyProblemSolverState {
    return {
      t: "CreepInsufficiencyProblemSolver",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      i: this.problemIdentifier,
      r: this.roomName,
      cr: {
        r: this.necessaryRoles,
        t: this.targetTaskIdentifier,
        c: this.requiredCreepCount,
        n: this.codename,
      },
    }
  }

  public static decode(state: CreepInsufficiencyProblemSolverState): CreepInsufficiencyProblemSolver {
    const children = decodeTasksFrom(state.c)
    return new CreepInsufficiencyProblemSolver(state.s, children, state.i, state.r, state.cr.r, state.cr.t, state.cr.c)
  }

  public static create(
    problemIdentifier: ProblemIdentifier,
    roomName: RoomName,
    necessaryRoles: CreepRole[],
    targetTaskIdentifier: TaskIdentifier | null,
    requiredCreepCount: number,
  ): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(Game.time, [], problemIdentifier, roomName, necessaryRoles, targetTaskIdentifier, requiredCreepCount)
  }

  public runTask(): TaskStatus {
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, this.necessaryRoles)
    const creepCount = World.resourcePools.countCreeps(this.roomName, this.targetTaskIdentifier, creepPoolFilter)
    const insufficientCreepCount = this.requiredCreepCount - creepCount
    if (insufficientCreepCount <= 0) {
      return TaskStatus.Finished
    }

    const request: CreepSpawnRequest = {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: insufficientCreepCount,
      codename: this.codename,
      roles: this.necessaryRoles,
      body: null,
      initialTask: null,
      taskIdentifier: this.targetTaskIdentifier,
      parentRoomName: null,
    }

    World.resourcePools.addSpawnCreepRequest(this.roomName, request)
    return TaskStatus.InProgress
  }
}
