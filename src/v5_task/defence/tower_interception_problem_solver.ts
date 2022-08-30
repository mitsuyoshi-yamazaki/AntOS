import { ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "v5_problem/problem_solver"
import { RoomName } from "shared/utility/room_name"
import { Task, TaskStatus } from "v5_task/task"
import { TowerPoolTaskPriority, TowerTask } from "world_info/resource_pool/tower_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { TowerInterception, TowerInterceptionTarget } from "process/process/defense/tower_interception"
import { RoomResources } from "room_resource/room_resources"

export interface TowerInterceptionProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName

  /** target id */
  ti: Id<AnyCreep> | null
}

export class TowerInterceptionProblemSolver extends ProblemSolver {
  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    private targetId: Id<AnyCreep> | null,
  ) {
    super(startTime, children, problemIdentifier)
  }

  public encode(): TowerInterceptionProblemSolverState {
    return {
      t: "TowerInterceptionProblemSolver",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      i: this.problemIdentifier,
      r: this.roomName,
      ti: this.targetId,
    }
  }

  public static decode(state: TowerInterceptionProblemSolverState, children: Task[]): TowerInterceptionProblemSolver {
    return new TowerInterceptionProblemSolver(state.s, children, state.i, state.r, state.ti)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName): TowerInterceptionProblemSolver {
    return new TowerInterceptionProblemSolver(Game.time, [], problemIdentifier, roomName, null)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return TaskStatus.Finished
    }
    const { target, allTargets } = TowerInterception.attackTarget(roomResource)
    if (target == null) {
      this.targetId = null
      return TaskStatus.Finished
    }

    const currentTarget = ((): AnyCreep | null => {
      if (this.targetId == null) {
        return null
      }
      return Game.getObjectById(this.targetId)
    })()

    const targetInfo = ((): TowerInterceptionTarget => {
      if (currentTarget != null) {
        const currentTargetId = currentTarget.id
        const currentTargetInfo = allTargets.find(info => info.target.id === currentTargetId)
        if (currentTargetInfo != null && currentTargetInfo.maxTicksToKill != null) {
          if (TowerInterception.canKill(currentTargetInfo, roomResource) === true) {
            return currentTargetInfo
          }
        }
      }
      return target
    })()

    this.targetId = targetInfo.target.id
    const needsAllTowers = ((): boolean => {
      if (!(targetInfo.target instanceof Creep)) {
        return true
      }
      if (targetInfo.target.body.length <= 1) {
        return false
      }
      return true
    })()
    World.resourcePools.addTowerTask(this.roomName, TowerTask.Attack(targetInfo.target, TowerPoolTaskPriority.Urgent, {needsAllTowers}))

    const text = `${targetInfo.maxTicksToKill}|${targetInfo.minimumTicksToEscape}`
    objects.controller.room.visual.text(text, targetInfo.target.pos, {color: "#FFFFFF"})

    // TODO: エネルギー足りなくなったらproblemを出す
    return TaskStatus.InProgress
  }
}
