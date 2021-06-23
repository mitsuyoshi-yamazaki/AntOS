import { CreepProviderObjective } from "task/creep_provider/creep_provider_objective"
import { decodeObjectiveFrom, Objective, ObjectiveState } from "task/objective"

export interface SignRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string[]

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
      m: this.mark,
      b: this.baseRoomName,
      cr: this.creepId,
      ci: this.fetchCreepIdentifier,
    }
  }

  public static decode(state: SignRoomObjectiveState): SignRoomObjective {
    const children = state.c.reduce((result, childState) => {
      const child = decodeObjectiveFrom(childState)
      if (child != null) {
        result.push(child)
      }
      return result
    }, [] as Objective[])
    return new SignRoomObjective(state.s, children, state.r, state.m, state.b, state.cr, state.ci)
  }

  public objectiveDescription(): string {
    const baseDescription = `- mark: ${this.mark}\n- target rooms: ${this.targetRoomNames}\n- child objectives: `
    if (this.children.length <= 0) {
      return `${baseDescription}none`
    }
    const childObjectivesDescription = this.children.reduce((result, child) => {
      return `${result}\n  - ${child.constructor.name}`
    }, "")
    return `${baseDescription}${childObjectivesDescription}`
  }

  // TODO: Event Drivenな形に書き直す
  public run(): void {
    this.checkCreep()

    if (this.creepId != null) {
      const creep = Game.getObjectById(this.creepId)
      if (creep instanceof Creep) {
        this.sign(creep)
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

  private sign(creep: Creep): void {
    creep.say("SIGN")
    if (this.targetRoomNames.includes(creep.room.name) !== true) {
      this.moveToNextRoom(creep)
    }
  }

  private moveToNextRoom(creep: Creep): void {

  }
}

/**
 *
 * [2:22:08 AM][shard2]fetching SignRoomObjective_33970091
[2:22:12 AM][shard2]checkCreep creep SignRoomObjective_33970091
[2:22:12 AM][shard2]no provider: init...
[2:22:12 AM][shard2]request with SignRoomObjective_33970093
[2:22:15 AM][shard2]checkCreep creep SignRoomObjective_33970093
[2:22:15 AM][shard2]no provider: init...
[2:22:15 AM][shard2]request with SignRoomObjective_33970094
[2:22:19 AM][shard2]checkCreep null
[2:22:19 AM][shard2]fetching SignRoomObjective_33970094
[2:22:23 AM][shard2]checkCreep creep SignRoomObjective_33970094
[2:22:23 AM][shard2]no provider: init...
[2:22:23 AM][shard2]request with SignRoomObjective_33970096
[2:22:27 AM][shard2]W47S12 is attacked!! W48S12 (W47S12)
[2:22:27 AM][shard2]
 */
