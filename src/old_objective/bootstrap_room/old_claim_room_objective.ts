import { SingleCreepProviderObjective } from "old_objective/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "old_objective/objective"
import { spawnPriorityLow } from "old_objective/spawn/spawn_creep_objective"
import { roomLink } from "utility/log"

type OldClaimRoomObjectiveProgressType = ObjectiveProgressType<string, StructureController, string>

export interface OldClaimRoomObjectiveState extends ObjectiveState {
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
export class OldClaimRoomObjective implements Objective {
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

  public encode(): OldClaimRoomObjectiveState {
    return {
      t: "OldClaimRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.targetRoomName,
      p: this.parentRoomName,
      i: this.claimerCreepId,
    }
  }

  public static decode(state: OldClaimRoomObjectiveState): OldClaimRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new OldClaimRoomObjective(state.s, children, state.r, state.p, state.i)
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

  public progress(): OldClaimRoomObjectiveProgressType {
    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      if (Game.shard.name !== "shardSeason") {
        return new ObjectiveFailed(`No target room ${this.targetRoomName} visibility`)
      }
    } else {
      if (targetRoom.controller == null) {
        return new ObjectiveFailed(`Target room ${this.targetRoomName} has no controller`)
      }
      if (targetRoom.controller.my) {
        return new ObjectiveSucceeded(targetRoom.controller)
      }
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
      return this.claim(creep)
    }
    return new ObjectiveFailed(`Claimer creep ${this.claimerCreepId} killed in action`)
  }

  /**
   * - [ ] 攻撃を受けるなどしている場合はnull
   */
  private activeParentRoom(): Room | null {
    return Game.rooms[this.parentRoomName]
  }

  private requestClaimerCreep(): OldClaimRoomObjectiveProgressType {
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
      priority: spawnPriorityLow,
    })
    this.creepProvider = creepProvider
    this.children.push(creepProvider)
    return new ObjectiveInProgress("Claimer creep requested")
  }

  private claim(creep: Creep): OldClaimRoomObjectiveProgressType {
    if (creep.room.name !== this.targetRoomName) {
      creep.moveToRoom(this.targetRoomName)
      return new ObjectiveInProgress(`Claimer creep heading to target room ${roomLink(this.targetRoomName)}, current: ${roomLink(creep.room.name)}`)
    }
    if (creep.room.controller == null) {
      return new ObjectiveFailed(`Target room ${roomLink(this.targetRoomName)} does not have a controller`)
    }

    const controller = creep.room.controller
    const result = creep.claimController(controller)
    switch (result) {
    case OK:
      return new ObjectiveSucceeded(controller)
    case ERR_NOT_IN_RANGE:
      creep.moveTo(controller, {reusePath: 15})
      return new ObjectiveInProgress(`Claimer creep heading to target room ${roomLink(this.targetRoomName)}, current: ${roomLink(creep.room.name)}`)
    default:
      return new ObjectiveFailed(`Unexpected claimController() error ${result}`)
    }
  }
}
