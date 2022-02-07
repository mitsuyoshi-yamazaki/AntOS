import { ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "v5_problem/problem_solver"
import { RoomName } from "utility/room_name"
import { Task, TaskStatus } from "v5_task/task"
import { TowerPoolTaskPriority, TowerTask } from "world_info/resource_pool/tower_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface TowerHealProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName

  /** target id */
  ti: Id<AnyCreep> | null
}

export class TowerHealProblemSolver extends ProblemSolver {
  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    private targetId: Id<AnyCreep> | null,
  ) {
    super(startTime, children, problemIdentifier)
  }

  public encode(): TowerHealProblemSolverState {
    return {
      t: "TowerHealProblemSolver",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      i: this.problemIdentifier,
      r: this.roomName,
      ti: this.targetId,
    }
  }

  public static decode(state: TowerHealProblemSolverState, children: Task[]): TowerHealProblemSolver {
    return new TowerHealProblemSolver(state.s, children, state.i, state.r, state.ti)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName): TowerHealProblemSolver {
    return new TowerHealProblemSolver(Game.time, [], problemIdentifier, roomName, null)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const countPart = (body: BodyPartConstant[], bodyType: BodyPartConstant): number => {
      return body.filter(b => b === bodyType).length
    }

    const target = ((): AnyCreep | null => {
      const creepInfo = objects.damagedCreeps.map((creep): {creep: AnyCreep, priority: number} => {
        if (creep instanceof PowerCreep) {
          return {
            creep,
            priority: 100000,
          }
        }
        const body = creep.body.map(body => body.type)
        const priority = countPart(body, HEAL) * 100 + countPart(body, ATTACK) * 10 + countPart(body, RANGED_ATTACK) * 3

        return {
          creep,
          priority,
        }
      })
      creepInfo.sort((lhs, rhs) => {
        return rhs.priority - lhs.priority
      })
      return creepInfo[0]?.creep ?? null
    })()

    if (target == null) {
      this.targetId = null
      return TaskStatus.Finished
    }
    this.targetId = target.id
    World.resourcePools.addTowerTask(this.roomName, TowerTask.Heal(target, TowerPoolTaskPriority.Low))

    // TODO: エネルギー足りなくなったらproblemを出す
    return TaskStatus.InProgress
  }
}
