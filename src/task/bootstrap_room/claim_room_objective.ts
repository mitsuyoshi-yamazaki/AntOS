import { SingleCreepProviderObjective } from "task/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "task/objective"

type ClaimRoomObjectiveProgressType = ObjectiveProgressType<string, StructureController, string>

export interface ClaimRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string

  /** parent room name */
  p: string

  /** claimer creep ID */
  i: string | null
}

/**
 * - State判定 -> Next Action
 * - claim (goal: Lv1 room controller)
 *   - room
 *     - invisible -> fail
 *     - visible
 *       - controller
 *         - null -> fail
 *         - exists
 *           - owner
 *             - exists -> fail
 *             - null
 *               - send claimer & claim
 *                 - not succeed -> fail
 *                 - success
 * - Game.io("launch ClaimRoomProcess target_room_name=W52S28 parent_room_name=W51S29")
 */
export class ClaimRoomObjective implements Objective {
  private creepProvider: SingleCreepProviderObjective | null = null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly targetRoomName: string,
    public readonly parentRoomName: string,
    private claimerCreepId: string | null,
  ) {
    for (const child of children) {
      if (child instanceof SingleCreepProviderObjective) {
        this.creepProvider = child
        break
      }
    }
  }

  public encode(): ClaimRoomObjectiveState {
    return {
      t: "ClaimRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.targetRoomName,
      p: this.parentRoomName,
      i: this.claimerCreepId,
    }
  }

  public static decode(state: ClaimRoomObjectiveState): ClaimRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new ClaimRoomObjective(state.s, children, state.r, state.p, state.i)
  }

  public objectiveDescription(): string {
    const creepDescription = this.claimerCreepId ?? "none"
    const baseDescription = `- target: ${this.targetRoomName}\n- parent: ${this.parentRoomName}\n- creep: ${creepDescription}\n- child objectives: `
    if (this.children.length <= 0) {
      return `${baseDescription}none`
    }
    const childObjectivesDescription = this.children.reduce((result, child) => {
      return `${result}\n  - ${child.constructor.name}`
    }, "")
    return `${baseDescription}${childObjectivesDescription}`
  }

  /**
   * - condition assertionを実行する
   *   - → それを中央集権で行うのがevent detector
   */
  public progress(): ClaimRoomObjectiveProgressType {
    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      return new ObjectiveFailed(`No target room ${this.targetRoomName} visibility`)
    }
    if (targetRoom.controller == null) {
      return new ObjectiveFailed(`Target room ${this.targetRoomName} has no controller`)
    }
    if (targetRoom.controller.my) {
      return new ObjectiveSucceeded(targetRoom.controller)
    }

    const parentRoom = this.activeParentRoom()
    if (parentRoom == null) {
      return new ObjectiveFailed(`Parent room ${this.parentRoomName} not active`)
    }

    if (this.claimerCreepId == null) {
      return this.requestClaimerCreep()
    }
    const creep = Game.getObjectById(this.claimerCreepId)
    if (creep instanceof Creep) {
      return this.claim(creep, targetRoom.controller)
    }
    return new ObjectiveFailed(`Claimer creep ${this.claimerCreepId} killed in action`)
  }

  /**
   * - [ ] 攻撃を受けるなどしている場合はnull
   */
  private activeParentRoom(): Room | null {
    return Game.rooms[this.parentRoomName]
  }

  private requestClaimerCreep(): ClaimRoomObjectiveProgressType {
    if (this.creepProvider != null) {
      const removeCreepProvider = (provider: SingleCreepProviderObjective) => {
        const index = this.children.indexOf(provider)
        if (index) {
          this.children.splice(index, 1)
        }
        this.creepProvider = null
      }

      const progress = this.creepProvider.progress()
      switch (progress.objectProgressType) {
      case "in progress":
        return new ObjectiveInProgress("Requesting claimer creep")
      case "succeeded":
        removeCreepProvider(this.creepProvider)
        this.claimerCreepId = progress.result.id
        return new ObjectiveInProgress("Fetched claimer creep")
      case "failed":
        removeCreepProvider(this.creepProvider)
        return new ObjectiveFailed(progress.reason)
      }
    }
    const identifier = `honey_yogurt_${Game.time}`  // TODO: generate generic unique ID
    const creepProvider = new SingleCreepProviderObjective(Game.time, [], identifier, {
      spawnRoomName: this.parentRoomName,
      requestingCreepBodyParts: [MOVE, MOVE, MOVE, MOVE, CLAIM, MOVE],
    })
    this.creepProvider = creepProvider
    this.children.push(creepProvider)
    return new ObjectiveInProgress("Claimer creep requested")
  }

  private claim(creep: Creep, controller: StructureController): ClaimRoomObjectiveProgressType {
    const result = creep.claimController(controller)
    switch (result) {
    case OK:
      return new ObjectiveSucceeded(controller)
    case ERR_NOT_IN_RANGE:
      creep.moveTo(controller, {reusePath: 15})
      return new ObjectiveInProgress(`Claimer creep heading to target room ${creep.pos}`)
    default:
      return new ObjectiveFailed(`Unexpected claimController() error ${result}`)
    }
  }
}
