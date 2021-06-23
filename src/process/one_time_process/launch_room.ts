import { MessageObserver } from "os/infrastructure/messenger"
import {
  Procedural,
  ProcessId,
  StatefulProcess,
} from "../process"

interface LaunchRoomProcessMemory {
  r: string   // target room name
  w: string[] // worker creep IDs
  c: string | null   // claimer creep ID
}

/**
 * - [objective based]
 *   - 以前は目的の切り替えを見込んでいなかったため巨大なモノリスになった
 *   - continuous upgrade controller
 *     - spawn creep
 *     - harvest energy
 *       - spawn creep
 *     - secure room
 *       - spawn creep
 *       - build tower
 *   - spawn creep
 *     - build spawn
 *     - build extensions
 *     - harvest energy
 * - タスク
 *   - 必要なcreepsの確保
 *   - claim room
 *   - build spawn
 *     - harvest energy
 *   - upgrade controller
 *     - harvest energy
 *
 *
 */
export class LaunchRoomProcess implements StatefulProcess, Procedural, MessageObserver {
  public readonly shouldStore = true

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: string,
    public claimerId: string | null,
    public workerIds: string[] = [],
  ) {
  }

  // ---- StatefulProcess ---- //
  public static parseState(rawState: unknown): LaunchRoomProcessMemory | null {
    const state = rawState as LaunchRoomProcessMemory
    if (typeof state.r !== "string") {
      return null
    }
    return state
  }

  public encode(): LaunchRoomProcessMemory {
    return {
      r: this.roomName,
      w: this.workerIds,
      c: this.claimerId,
    }
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
    const room = Game.rooms[this.roomName]
    if (room == null || room.controller == null) {
      return
    }
    if (room.controller.my) {
      this.constructSpawn(room, room.controller)
    } else {
      this.claimController(room.controller)
    }
  }

  private getCreepById(creepId: string): Creep | null {
    const creep = Game.getObjectById(creepId)
    if (creep instanceof Creep) {
      return creep
    }
    return null
  }

  private claimController(controller: StructureController): void {
    if (this.claimerId == null) {
      return
    }
    const claimer = this.getCreepById(this.claimerId)
    if (claimer == null) {
      return
    }
    const result = claimer.claimController(controller)
    if (result === ERR_NOT_IN_RANGE) {
      claimer.moveTo(controller)
    }
  }

  private constructSpawn(room: Room, controller: StructureController): void {
    const workers: Creep[] = []
    this.workerIds.forEach(creepId => {
      const worker = this.getCreepById(creepId)
      if (worker != null) {
        workers.push(worker)
      }
    })

    const constructionSite = room.find(FIND_CONSTRUCTION_SITES, {
      filter: (site: ConstructionSite) => site.my
    })[0]
    const energySource = room.find(FIND_SOURCES)[0]

    if (constructionSite == null) {
      if (energySource != null) {
        workers.forEach(worker => {
          this.upgradeController(worker, energySource, controller)
        })
      }
      return
    }

    if (energySource != null) {
      workers.forEach(worker => {
        this.build(worker, energySource, constructionSite)
      })
    }
  }

  private build(worker: Creep, energySource: Source, constructionSite: ConstructionSite): void {
    if (worker.carry.energy <= 0) {
      if (energySource != null) {
        this.harvest(worker, energySource)
      }
      return
    }
    if (worker.build(constructionSite) === ERR_NOT_IN_RANGE) {
      worker.moveTo(constructionSite, { reusePath: 10 })
    }
  }

  private upgradeController(worker: Creep, energySource: Source, controller: StructureController): void {
    if (worker.carry.energy <= 0) { // FixMe: 状態の切り替えができていない
      if (energySource != null) {
        this.harvest(worker, energySource)
      }
      return
    }
    if (worker.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      worker.moveTo(controller, { reusePath: 10 })
    }
  }

  private harvest(worker: Creep, energySource: Source): void {
    if (worker.harvest(energySource) === ERR_NOT_IN_RANGE) {
      worker.moveTo(energySource, {reusePath: 10})
    }
  }

  // ---- MessageObserver ---- //
  public didReceiveMessage(creepId: unknown): string {
    if (typeof (creepId) !== "string") {
      return `LaunchRoomProcess ${this.processId} invalid message ${creepId}`
    }
    const creep = Game.getObjectById(creepId)
    if (!(creep instanceof Creep)) {
      return `LaunchRoomProcess ${this.processId} invalid message ${creepId}, creep not found`
    }

    const creepBodyParts = creep.body.map(b => b.type)
    if (creepBodyParts.includes(CLAIM)) {
      this.claimerId = creepId
      creep.memory.squad_name = ""
      return `LaunchRoomProcess ${this.processId} received claimer ID`
    }

    if (creepBodyParts.includes(WORK)) {
      this.workerIds.push(creepId)
      creep.memory.squad_name = ""
      return `LaunchRoomProcess ${this.processId} received worker ID`
    }
    return `LaunchRoomProcess ${this.processId} invalid creep ${creepId}, creep has no CLAIM nor WORK parts`
  }
}

// ---- Objective Base Decision Making ---- //
/**
 * - 処理をもつDependency
 */
export interface PreRequirementDefinition {
  canStart(): boolean
}

export interface GoalDefinition {
  isFinished(): boolean
}

export interface Objective {
  description: string
  preRequirement: PreRequirementDefinition
  goal: GoalDefinition
}

/**
 * - 前提条件
 *   - Spawnが近所にあること
 *   - RCL > nであること
 *   - 対象roomがclaimされていないこと
 */
export class ClaimRoomPreRequirement implements PreRequirementDefinition {
  public constructor(
    public readonly targetRoomName: string,
  ) {}

  public canStart(): boolean {
    const room = Game.rooms[this.targetRoomName]
    if (room == null) {
      return false
    }
    if (room.controller == null || room.controller.owner != null) {
      return false
    }
    const hasSpawnNearby = true // TODO:
    return hasSpawnNearby
  }
}

// export class ClaimRoomObjective implements Objective {
//   public readonly description = "claim room"
//   public readonly preRequirement = new ClaimRoomPreRequirement()
//   goal: GoalDefinition
// }

/**
 * - 探索
 */
export class ObserveObjective {
  public constructor(
    public readonly targetRoomName: string,
  ) { }
}
