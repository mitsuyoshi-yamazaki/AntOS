import { CreepTask } from "object_task/creep_task/creep_task"
import { ProblemIdentifier } from "problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "problem/problem_solver"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { generateCodename } from "utility/unique_id"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepSpawnRequest, CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"
import type { CreepTaskState } from "object_task/creep_task/creep_task_state"
import { decodeCreepTaskFromState } from "object_task/creep_task/creep_task_decoder"

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

    /** initial task state */
    s: CreepTaskState | null

    /** priority */
    p: CreepSpawnRequestPriority

    /** body */
    b: BodyPartConstant[] | null
  }
}

export class CreepInsufficiencyProblemSolver extends ProblemSolver {
  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    private readonly necessaryRoles: CreepRole[],
    private readonly targetTaskIdentifier: TaskIdentifier | null,
    private readonly requiredCreepCount: number,
    public codename: string,
    public initialTask: CreepTask | null,
    public priority: CreepSpawnRequestPriority,
    public body: BodyPartConstant[] | null,
  ) {
    super(startTime, children, problemIdentifier)
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
        s: this.initialTask?.encode() ?? null,
        p: this.priority,
        b: this.body,
      },
    }
  }

  public static decode(state: CreepInsufficiencyProblemSolverState, children: Task[]): CreepInsufficiencyProblemSolver {
    const initialTask = ((): CreepTask | null => {
      if (state.cr.s == null) {
        return null
      }
      return decodeCreepTaskFromState(state.cr.s)
    })()
    return new CreepInsufficiencyProblemSolver(state.s, children, state.i, state.r, state.cr.r, state.cr.t, state.cr.c, state.cr.n, initialTask, state.cr.p, state.cr.b)
  }

  public static create(
    problemIdentifier: ProblemIdentifier,
    roomName: RoomName,
    necessaryRoles: CreepRole[],
    targetTaskIdentifier: TaskIdentifier | null,
    requiredCreepCount: number,
  ): CreepInsufficiencyProblemSolver {
    const time = Game.time
    return new CreepInsufficiencyProblemSolver(
      time,
      [],
      problemIdentifier,
      roomName,
      necessaryRoles,
      targetTaskIdentifier,
      requiredCreepCount,
      generateCodename("CreepInsufficiencyProblemSolver", time),
      null,
      CreepSpawnRequestPriority.Low,
      null,
    )
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
      body: this.body,
      initialTask: this.initialTask,
      taskIdentifier: this.targetTaskIdentifier,
      parentRoomName: null,
    }

    World.resourcePools.addSpawnCreepRequest(this.roomName, request)
    return TaskStatus.InProgress
  }
}
