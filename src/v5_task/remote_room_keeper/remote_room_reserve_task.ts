import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "v5_task/task_state"
import { World } from "world_info/world_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepInsufficiencyProblemFinder } from "v5_problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { ReserveControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/reserve_controller_api_wrapper"
import { bodyCost } from "utility/creep_body"
import { Invader } from "game/invader"

export interface RemoteRoomReserveTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName
}

export class RemoteRoomReserveTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
  }

  public encode(): RemoteRoomReserveTaskState {
    return {
      t: "RemoteRoomReserveTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: RemoteRoomReserveTaskState, children: Task[]): RemoteRoomReserveTask {
    return new RemoteRoomReserveTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName): RemoteRoomReserveTask {
    return new RemoteRoomReserveTask(Game.time, [], roomName, targetRoomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = [
    ]

    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom == null) {
      return TaskStatus.InProgress
    }
    const targetController = targetRoom.controller
    if (targetController == null) {
      return TaskStatus.Failed
    }
    if (targetController.owner != null) {
      return TaskStatus.Failed // TODO: 攻撃等に対するproblem finder
    }
    const excludedUsernames = [Game.user.name, Invader.username]
    if (targetController.reservation != null && excludedUsernames.includes(targetController.reservation.username) !== true) {
      return TaskStatus.Failed // TODO: 攻撃等に対するproblem finder
    }

    problemFinders.push(...this.runReserver(objects, targetController))
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  // ---- Reserve ---- //
  private runReserver(objects: OwnedRoomObjects, targetController: StructureController): ProblemFinder[] {
    const necessaryRoles: CreepRole[] = [CreepRole.Claimer]
    const filterTaskIdentifier = this.taskIdentifier
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (): CreepTask | null => {
        return this.newClaimerTaskFor(targetController)
      },
      creepPoolFilter,
    )

    const minimumBody = [MOVE, MOVE, CLAIM, CLAIM]
    if (bodyCost(minimumBody) > objects.controller.room.energyCapacityAvailable) {  // TODO: Problem Finderにする
      return []
    }

    if (targetController.reservation == null || targetController.reservation.username !== Game.user.name || targetController.reservation.ticksToEnd < 4400) {
      const targetRoom = World.rooms.get(this.targetRoomName)
      if (targetRoom != null) {
        const invaded = targetRoom.find(FIND_HOSTILE_CREEPS).some(creep => creep.owner.username === Invader.username)
        if (invaded !== true) {
          return [this.createCreepInsufficiencyProblemFinder(objects, minimumBody, necessaryRoles, filterTaskIdentifier)]
        }
      }
    }
    return []
  }

  private createCreepInsufficiencyProblemFinder(objects: OwnedRoomObjects, minimumBody: BodyPartConstant[], necessaryRoles: CreepRole[], filterTaskIdentifier: TaskIdentifier): ProblemFinder {
    const roomName = objects.controller.room.name
    const minimumCreepCount = 1
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, necessaryRoles, filterTaskIdentifier, minimumCreepCount)

    return {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.startTime)
          solver.body = this.createReserverBody(minimumBody, objects.controller.room.energyCapacityAvailable)
        }
        if (solver != null) {
          this.addChildTask(solver)
          return [solver]
        }
        return []
      },
    }
  }

  private createReserverBody(minimumBody: BodyPartConstant[], energyCapacity: number): BodyPartConstant[] {
    const maximumBody = [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      CLAIM, CLAIM,
    ]

    return bodyCost(maximumBody) <= energyCapacity ? maximumBody : minimumBody
  }

  private newClaimerTaskFor(targetController: StructureController): CreepTask | null {
    const options: SequentialTaskOptions = {
      ignoreFailure: false,
      finishWhenSucceed: false,
    }
    const childTasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, []),
      MoveToTargetTask.create(ReserveControllerApiWrapper.create(targetController)),
    ]
    return SequentialTask.create(childTasks, options)
  }
}
