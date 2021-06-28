import { TowerAttackTask, TowerAttackTaskTargetType } from "game_object_task/tower_task/tower_attack_task"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "objective/objective"
import { roomLink } from "utility/log"

type DefendOwnedRoomObjectiveTargetType = TowerAttackTaskTargetType
type DefendOwnedRoomObjectiveProgressType = ObjectiveProgressType<DefendOwnedRoomObjectiveTargetType, void, string>

export interface DefendOwnedRoomObjectiveState extends ObjectiveState {
  /** target ID */
  i: Id<DefendOwnedRoomObjectiveTargetType>
}

export class DefendOwnedRoomObjective implements Objective {

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private targetId: Id<DefendOwnedRoomObjectiveTargetType>,
  ) {
  }

  public encode(): DefendOwnedRoomObjectiveState {
    return {
      t: "DefendOwnedRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      i: this.targetId,
    }
  }

  public static decode(state: DefendOwnedRoomObjectiveState): DefendOwnedRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new DefendOwnedRoomObjective(state.s, children, state.i)
  }

  public progress(room: Room, hostileCreeps: Creep[], hostilePowerCreeps: PowerCreep[], towers: StructureTower[]): DefendOwnedRoomObjectiveProgressType {
    if (towers.length <= 0) {
      return new ObjectiveFailed(`No tower in room ${roomLink(room.name)}`)
    }

    const target = Game.getObjectById(this.targetId)
    if (target != null) {
      this.attack(target, towers)
      return new ObjectiveInProgress(target)
    }

    const newTarget = DefendOwnedRoomObjective.chooseNewTarget(hostileCreeps, hostilePowerCreeps)
    if (newTarget != null) {
      this.targetId = newTarget.id
      this.attack(newTarget, towers)
      return new ObjectiveInProgress(newTarget)
    }

    return new ObjectiveSucceeded(undefined)
  }

  private attack(target: DefendOwnedRoomObjectiveTargetType, towers: StructureTower[]): void {
    towers.forEach(tower => {
      if (tower.task == null) {
        tower.task = new TowerAttackTask(Game.time, target)
      }
      if (tower.task?.run(tower) !== "in progress") {
        tower.task = null
      }
    })
  }

  public static chooseNewTarget(hostileCreeps: Creep[], hostilePowerCreeps: PowerCreep[]): DefendOwnedRoomObjectiveTargetType | null {
    if (hostileCreeps.length > 0) {
      return hostileCreeps.reduce((result, current) => result.hits < current.hits ? result : current)
    }
    if (hostilePowerCreeps.length > 0) {
      return hostilePowerCreeps.reduce((result, current) => result.hits < current.hits ? result : current)
    }
    return null
  }
}
