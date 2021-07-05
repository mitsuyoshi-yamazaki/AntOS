import { ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunnerIdentifier } from "objective/task_runner"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { CreepTask, CreepTaskState, decodeCreepTaskFromState } from "task/creep_task/creep_task"
import { creepSpawnRequestPriorityLow } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

export interface CreepInsufficiencyProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName,

  /** creep roles */
  cr: CreepRole[]

  /** creep body */
  cb: BodyPartConstant[] | null

  /** initial task */
  it: CreepTaskState | null

  /** creep task runner identifier */
  ct: TaskRunnerIdentifier | null

  /** remote room name */
  rr: RoomName | null
}

export class CreepInsufficiencyProblemSolver implements ProblemSolver {
  public get taskRunnerIdentifier(): TaskRunnerIdentifier {
    return this.problemIdentifier
  }

  private constructor(
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
    public readonly body: BodyPartConstant[] | null,

    /** 時間経過で消滅する可能性のあるタスクは推奨されない */
    public readonly initialTask: CreepTask | null,
    public readonly registeredTaskRunnerIdentifier: TaskRunnerIdentifier | null,
    public readonly remoteRoomName: RoomName | null,
  ) {
  }

  public encode(): CreepInsufficiencyProblemSolverState {
    return {
      t: "CreepInsufficiencyProblemSolver",
      p: this.problemIdentifier,
      r: this.roomName,
      cr: this.roles,
      cb: this.body,
      it: this.initialTask?.encode() ?? null,
      ct: this.registeredTaskRunnerIdentifier,
      rr: this.remoteRoomName,
    }
  }

  public static decode(state: CreepInsufficiencyProblemSolverState): CreepInsufficiencyProblemSolver {
    const initialTask = ((): CreepTask | null => {
      if (state.it == null) {
        return null
      }
      return decodeCreepTaskFromState(state.it)
    })()
    return new CreepInsufficiencyProblemSolver(state.p, state.r, state.cr, state.cb, initialTask, state.ct, state.rr)
  }

  public static create(
    problemIdentifier: ProblemIdentifier,
    roomName: RoomName,
    roles: CreepRole[],
    body: BodyPartConstant[] | null,
    initialTask: CreepTask | null,
    taskRunnerIdentifier: TaskRunnerIdentifier | null,
    remoteRoomName: RoomName | null,
  ): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(problemIdentifier, roomName, roles, body, initialTask, taskRunnerIdentifier, remoteRoomName)
  }

  public run(): void {
    World.resourcePools.addSpawnCreepRequest(
      this.roomName,
      {
        priority: creepSpawnRequestPriorityLow,
        numberOfCreeps: 1,  // TODO:
        roles: this.roles,
        body: this.body,
        codename: "creep",  // TODO:
        initialTask: this.initialTask,
        taskRunnerIdentifier: this.registeredTaskRunnerIdentifier,
        parentRoomName: this.remoteRoomName,
      }
    )
  }
}
