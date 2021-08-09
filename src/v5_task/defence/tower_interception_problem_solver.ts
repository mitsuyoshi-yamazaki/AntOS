import { ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "v5_problem/problem_solver"
import { RoomName } from "utility/room_name"
import { Task, TaskStatus } from "v5_task/task"
import { TowerPoolTaskPriority, TowerTask } from "world_info/resource_pool/tower_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { GameConstants } from "utility/constants"

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
    const target = ((): AnyCreep | null => {
      const hostileCreeps: AnyCreep[] = [
        ...objects.hostiles.creeps,
        ...objects.hostiles.powerCreeps,
      ]

      if (this.targetId != null && ((Game.time % 29) !== 3)) {
        const stored = Game.getObjectById(this.targetId)
        if (stored != null && stored.room != null && stored.room.name === this.roomName) {
          if (stored.hits < stored.hitsMax) {
            return stored
          }
          const min = GameConstants.room.edgePosition.min
          const max = GameConstants.room.edgePosition.max
          const otherTargets = hostileCreeps.filter(creep => {
            if (creep.id === this.targetId) {
              return false
            }
            if (creep.pos.x === min || creep.pos.x === max || creep.pos.y === min || creep.pos.y === max) {
              return false
            }
            return true
          })
          const target = objects.controller.pos.findClosestByRange(otherTargets)
          if (target != null) {
            return target
          }
          return stored
        }
        this.targetId = null
      }
      if (this.roomName === "W6S27") {
        const min = GameConstants.room.edgePosition.min + 2
        const max = GameConstants.room.edgePosition.max - 2
        const hostileInsideRoom = hostileCreeps.filter(creep => {
          if (creep.pos.y >= 25 && creep.pos.x <= 10) {
            return false
          }
          if (creep.pos.x < (min + 2) || creep.pos.x > (max - 2) || creep.pos.y < min || creep.pos.y > max) {
            return false
          }
          return true
        })
        return objects.controller.pos.findClosestByRange(hostileInsideRoom)
      }

      const min = GameConstants.room.edgePosition.min
      const max = GameConstants.room.edgePosition.max
      const hostileInsideRoom = ((): AnyCreep[] => {
        if ((Game.time % 21) < 7) {
          return hostileCreeps
        }
        return hostileCreeps.filter(creep => {
          if (creep.pos.x === min || creep.pos.x === max || creep.pos.y === min || creep.pos.y === max) {
            return false
          }
          return true
        })
      })()
      return objects.controller.pos.findClosestByRange(hostileInsideRoom)
    })()

    if (target == null) {
      this.targetId = null
      return TaskStatus.Finished
    }
    this.targetId = target.id
    World.resourcePools.addTowerTask(this.roomName, TowerTask.Attack(target, TowerPoolTaskPriority.Urgent))

    // TODO: エネルギー足りなくなったらproblemを出す
    return TaskStatus.InProgress
  }
}
