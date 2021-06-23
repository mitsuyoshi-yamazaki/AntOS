import { CreepProviderObjective } from "task/creep_provider/creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export interface SignRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string[]

  /** current target room name */
  ct: string | null

  /** sign mark */
  m: string

  /** base room name */
  b: string

  /** creep id */
  cr: string | null

  /** fetching creep identifier */
  ci: string | null
}

/**
 * - 指定されたRoomsにsignする
 *   - W53S28,W53S29,W54S28,W54S29
 * - 自分のsignであってもmarkが含まれていない場合は上書きする
 */
export class SignRoomObjective implements Objective {
  private creepProvider: CreepProviderObjective | null = null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly targetRoomNames: string[],
    public readonly mark: string,
    public readonly baseRoomName: string,
    private creepId: string | null,
    private fetchCreepIdentifier: string | null,
    private currentTargetRoomName: string | null,
  ) {
    const creepProvider = children.find(child => child instanceof CreepProviderObjective)
    if (creepProvider instanceof CreepProviderObjective) {
      this.creepProvider = creepProvider
    }
  }

  public encode(): SignRoomObjectiveState {
    return {
      s: this.startTime,
      t: "SignRoomObjective",
      c: this.children.map(child => child.encode()),
      r: this.targetRoomNames,
      ct: this.currentTargetRoomName,
      m: this.mark,
      b: this.baseRoomName,
      cr: this.creepId,
      ci: this.fetchCreepIdentifier,
    }
  }

  public static decode(state: SignRoomObjectiveState): SignRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new SignRoomObjective(state.s, children, state.r, state.m, state.b, state.cr, state.ci, state.ct)
  }

  public objectiveDescription(): string {
    const creepDescription = this.creepId ?? "none"
    const targetDescription = this.currentTargetRoomName ?? "none"
    const baseDescription = `- mark: ${this.mark}\n- target rooms: ${this.targetRoomNames}\n- creep: ${creepDescription}\n- next: ${targetDescription}\n- child objectives: `
    if (this.children.length <= 0) {
      return `${baseDescription}none`
    }
    const childObjectivesDescription = this.children.reduce((result, child) => {
      return `${result}\n  - ${child.constructor.name}`
    }, "")
    return `${baseDescription}${childObjectivesDescription}`
  }

  // TODO: Event Drivenな形に書き直す
  // TODO: Objective間のインターフェースを定義する
  public run(): void {
    this.checkCreep()

    if (this.creepId != null) {
      const creep = Game.getObjectById(this.creepId)
      if (creep instanceof Creep) {
        this.runWithCreep(creep)
        return
      }
      this.creepId = null
    }

    if (this.fetchCreepIdentifier != null) {
      return  // fetching
    }
    this.fetchCreep()
  }

  private checkCreep(): void {
    if (this.creepProvider != null && this.fetchCreepIdentifier != null) {
      const creep = this.creepProvider.checkCreep(this.baseRoomName, this.fetchCreepIdentifier)
      if (creep != null) {
        this.creepId = creep.id
        this.fetchCreepIdentifier = null
      }
    }
  }

  private createCreepIdentifier(): string {
    return `${this.constructor.name}_${Game.time}`
  }

  private fetchCreep(): void {
    const getCreepProvider = (): CreepProviderObjective => {
      if (this.creepProvider != null) {
        return this.creepProvider
      }
      const provider = new CreepProviderObjective(Game.time, [], [])
      this.creepProvider = provider
      this.children.push(provider)
      return provider
    }

    const creepProvider = getCreepProvider()
    const identifier = this.createCreepIdentifier()
    this.fetchCreepIdentifier = identifier
    creepProvider.requestScout(this.baseRoomName, 2, identifier)
  }

  private runWithCreep(creep: Creep): void {
    if (this.currentTargetRoomName != null) {
      const controller = creep.room.controller
      if (this.currentTargetRoomName === creep.room.name && controller != null) {
        this.signController(creep, controller)
      } else {
        creep.moveToRoom(this.currentTargetRoomName)
      }
      return
    }

    this.moveToNextRoom(creep)
  }

  private shouldSign(controller: StructureController): boolean {
    if (controller.sign == null) {
      return true
    }
    if (controller.sign.username !== Game.user.name) {
      return true
    }
    if (controller.sign.text.includes(this.mark) !== true) {
      return true
    }
    return false
  }

  private signController(creep: Creep, controller: StructureController): void {
    const signText = `${this.mark} at ${Game.time}`
    switch (creep.signController(controller, signText)) {
    case OK:
      this.currentTargetRoomName = null
      break
    case ERR_NOT_IN_RANGE:
      creep.moveTo(controller, { reusePath: 15 })
      creep.say(this.mark)
      break
    default:
      break
    }
  }

  private moveToNextRoom(creep: Creep): void {
    const target = this.targetRoomNames.find(roomName => {
      const room = Game.rooms[roomName]
      if (room == null) {
        return true
      }
      if (room.controller == null) {
        return false
      }
      return this.shouldSign(room.controller)
    })
    if (target != null) {
      this.currentTargetRoomName = target
      creep.moveToRoom(target)
      creep.say(this.mark)
    } else {
      this.currentTargetRoomName = null
      creep.say("😴")
    }
  }
}
