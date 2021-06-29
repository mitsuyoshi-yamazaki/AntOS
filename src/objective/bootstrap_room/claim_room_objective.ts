import { ClaimControllerTask } from "game_object_task/creep_task/claim_controller_task"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "objective/objective"
import { SpawnCreepObjective, spawnPriorityLow } from "objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"

type ClaimRoomObjectiveProgressType = ObjectiveProgressType<string, StructureController, string>

export interface ClaimRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string

  /** claimer creep name */
  n: CreepName | null

  /** requesting */
  rq: boolean
}

export class ClaimRoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly targetRoomName: string,
    private claimerName: CreepName | null,
    private requestingClaimerCreep: boolean,
  ) {
  }

  public encode(): ClaimRoomObjectiveState {
    return {
      t: "ClaimRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.targetRoomName,
      n: this.claimerName,
      rq: this.requestingClaimerCreep,
    }
  }

  public static decode(state: ClaimRoomObjectiveState): ClaimRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new ClaimRoomObjective(state.s, children, state.r, state.n, state.rq)
  }

  public objectiveDescription(): string {
    const creepDescription = this.claimerName ?? "none"
    const baseDescription = `- target: ${this.targetRoomName}\n- creep: ${creepDescription}\n- child objectives: `
    if (this.children.length <= 0) {
      return `${baseDescription}none`
    }
    const childObjectivesDescription = this.children.reduce((result, child) => {
      return `${result}\n  - ${child.constructor.name}`
    }, "")
    return `${baseDescription}${childObjectivesDescription}`
  }

  public static generateCreepName(): string {
    return generateUniqueId("ghana_chocolate")
  }

  public didSpawnCreep(creepNames: CreepName[]): void {
    if (this.claimerName == null) {
      return
    }
    if (this.requestingClaimerCreep === false) {
      return
    }
    if (creepNames.includes(this.claimerName) !== true) {
      return
    }
    this.requestingClaimerCreep = false
  }

  public didCancelCreep(creepNames: CreepName[]): void {
    if (this.claimerName == null) {
      return
    }
    if (this.requestingClaimerCreep === false) {
      return
    }
    if (creepNames.includes(this.claimerName) !== true) {
      return
    }
    this.claimerName = ClaimRoomObjective.generateCreepName()
    this.requestingClaimerCreep = true
  }

  public progress(spawnCreepObjective: SpawnCreepObjective): ClaimRoomObjectiveProgressType {
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

    if (this.requestingClaimerCreep === true) {
      return new ObjectiveInProgress("Requesting claimer creep")
    }

    if (this.claimerName == null) {
      const creepName = ClaimRoomObjective.generateCreepName()
      const body: BodyPartConstant[] = [MOVE, CLAIM, MOVE]
      const memory: CreepMemory = {
        ts: null,
        squad_name: "",
        status: CreepStatus.NONE,
        birth_time: Game.time,
        type: CreepType.CREEP_PROVIDER,
        should_notify_attack: false,
        let_thy_die: true,
      }
      spawnCreepObjective.enqueueCreep(creepName, body, memory, spawnPriorityLow)
      this.claimerName = creepName
      this.requestingClaimerCreep = true
      return new ObjectiveInProgress(`Queued claimer creep ${creepName}`)
    }

    const creep = Game.creeps[this.claimerName]
    if (creep == null) {
      this.claimerName = null
      this.requestingClaimerCreep = false
      return new ObjectiveInProgress(`Creep ${this.claimerName} killed in action`)
    }
    if (creep.spawning === true) {
      return new ObjectiveInProgress("")
    }
    if (creep.task == null) {
      creep.task = new ClaimControllerTask(Game.time, targetRoom.controller)
    }
    if (creep.task?.run(creep) !== "in progress") {
      creep.task = null
    }
    return new ObjectiveInProgress("")
  }
}
