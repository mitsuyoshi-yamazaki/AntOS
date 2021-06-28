import { ErrorMapper } from "error_mapper/ErrorMapper"
import { DefendOwnedRoomObjective } from "objective/defend_room/defend_owned_room_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveState } from "objective/objective"
import { SpawnCreepObjective } from "objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"
import { EnergyChargeableStructure } from "prototype/room_object"
import { roomLink } from "utility/log"
import { LowLevelWorkerObjective } from "./low_level_worker_objective"
import { OwnedRoomObjectCache } from "./owned_room_object_cache"

export interface RoomKeeperObjectiveEvents {
  spawnedCreeps: number
  canceledCreepNames: CreepName[]
  status: string
}

type RoomKeeperObjectiveProgressType = ObjectiveInProgress<RoomKeeperObjectiveEvents> | ObjectiveFailed<string>

export interface RoomKeeperObjectiveState extends ObjectiveState {
  /** room name */
  r: RoomName,
}

/**
 * - successしない
 */
export class RoomKeeperObjective implements Objective {
  private readonly spawnCreepObjective: SpawnCreepObjective
  private readonly workerObjective: LowLevelWorkerObjective // TODO: RCLごとに実行するobjectiveを切り替える
  private defendRoomObjective: DefendOwnedRoomObjective | null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly roomName: RoomName,
  ) {
    let spawnCreepObjective: SpawnCreepObjective | null = null
    let workerObjective: LowLevelWorkerObjective | null = null
    let defendRoomObjective: DefendOwnedRoomObjective | null = null
    children.forEach(child => {
      if (child instanceof SpawnCreepObjective) {
        spawnCreepObjective = child
        return
      }
      if (child instanceof LowLevelWorkerObjective) {
        workerObjective = child
        return
      }
      if (child instanceof DefendOwnedRoomObjective) {
        defendRoomObjective = child
        return
      }
    })
    this.spawnCreepObjective = ((): SpawnCreepObjective => {
      if (spawnCreepObjective != null) {
        return spawnCreepObjective
      }
      const newObjective = new SpawnCreepObjective(Game.time, [], [])
      this.children.push(newObjective)
      return newObjective
    })()
    this.workerObjective = ((): LowLevelWorkerObjective => {
      if (workerObjective != null) {
        return workerObjective
      }
      const newObjective = new LowLevelWorkerObjective(Game.time, [], [], [], null)
      this.children.push(newObjective)
      return newObjective
    })()
    this.defendRoomObjective = defendRoomObjective
  }

  public encode(): RoomKeeperObjectiveState {
    return {
      t: "RoomKeeperObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: RoomKeeperObjectiveState): RoomKeeperObjective {
    const children = decodeObjectivesFrom(state.c)
    return new RoomKeeperObjective(state.s, children, state.r)
  }

  public progress(): RoomKeeperObjectiveProgressType {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      return new ObjectiveFailed(`${roomLink(this.roomName)} is not visible`)
    }

    const roomObjects = OwnedRoomObjectCache.objectsInRoom(room)
    if (roomObjects == null) {
      return new ObjectiveFailed(`${roomLink(this.roomName)} is not owned by me`)
    }

    let status = ""

    if (roomObjects.hostiles.creeps.length > 0 || roomObjects.hostiles.powerCreeps.length > 0) {
      ErrorMapper.wrapLoop((): void => {
        const attackState = this.defend(room, roomObjects.hostiles.creeps, roomObjects.hostiles.powerCreeps, roomObjects.activeStructures.towers)
        status += attackState
      }, "RoomKeeperObjective.defend()")()
    } else {
      if (this.defendRoomObjective != null) {
        this.removeDefendRoomObjective(this.defendRoomObjective)
      }
    }

    let workerStatus = null as string | null

    ErrorMapper.wrapLoop((): void => {
      workerStatus = this.runWorker(
        roomObjects.sources,
        roomObjects.activeStructures.chargeableStructures,
        roomObjects.controller,
        roomObjects.constructionSites
      )
    }, "RoomKeeperObjective.runWorker()")()
    status += workerStatus == null ? `${this.workerObjective.constructor.name} failed execution` : workerStatus

    let spawnResult = null as [number, CreepName[]] | null

    ErrorMapper.wrapLoop((): void => {
      spawnResult = this.runCreepSpawn(room, roomObjects.activeStructures.spawns)
    }, "RoomKeeperObjective.runCreepSpawn()")()

    const [spawnedCreeps, canceledCreepNames] = spawnResult ?? [0, []]

    const event: RoomKeeperObjectiveEvents = {
      spawnedCreeps,
      canceledCreepNames,
      status,
    }

    return new ObjectiveInProgress(event)
  }

  // ---- Private ---- //
  private runWorker(
    sources: Source[],
    chargeableStructures: EnergyChargeableStructure[],
    controller: StructureController,
    constructionSites: ConstructionSite<BuildableStructureConstant>[],
  ): string {

    const workerProgress = this.workerObjective.progress(sources, chargeableStructures, controller, constructionSites, this.spawnCreepObjective)
    return ((): string => {
      switch (workerProgress.objectProgressType) {
      case "in progress": {
        const deadsDescription = workerProgress.value.diedWorkers > 0 ? `, ${workerProgress.value.diedWorkers} died` : ""
        return `${workerProgress.value.workers} workers, ${workerProgress.value.queueingWorkers} in queue${deadsDescription}`
      }
      case "failed":
        return workerProgress.reason
      }
    })()
  }

  private defend(room: Room, hostileCreeps: Creep[], hostilePowerCreeps: PowerCreep[], towers: StructureTower[]): string {
    const attackingPlayerNames: string[] = []
    hostileCreeps.forEach(creep => {
      if (attackingPlayerNames.includes(creep.owner.username) !== true) {
        attackingPlayerNames.push(creep.owner.username)
      }
    })
    hostilePowerCreeps.forEach(powerCreep => {
      if (attackingPlayerNames.includes(powerCreep.owner.username) !== true) {
        attackingPlayerNames.push(powerCreep.owner.username)
      }
    })

    const defendRoomObjective = ((): DefendOwnedRoomObjective | null => {
      if (this.defendRoomObjective != null) {
        return this.defendRoomObjective
      }
      const target = DefendOwnedRoomObjective.chooseNewTarget(hostileCreeps, hostilePowerCreeps)
      if (target == null) {
        return null // 来ない想定
      }
      const objective = new DefendOwnedRoomObjective(Game.time, [], target.id)
      this.defendRoomObjective = objective
      this.children.push(objective)
      return objective
    })()

    if (defendRoomObjective == null) {
      return "wrong code" // 来ない想定
    }

    const progress = defendRoomObjective.progress(room, hostileCreeps, hostilePowerCreeps, towers)
    switch (progress.objectProgressType) {
    case "in progress":
      break
    case "succeeded":
      this.removeDefendRoomObjective(defendRoomObjective)
      break
    case "failed":
      break
    }

    return `${roomLink(room.name)} is attacked by ${attackingPlayerNames}`
  }

  private removeDefendRoomObjective(defendRoomObjective: DefendOwnedRoomObjective): void {
    const index = this.children.indexOf(defendRoomObjective)
    if (index >= 0) {
      this.children.splice(index, 1)
    }
  }

  private runCreepSpawn(room: Room, spawns: StructureSpawn[]): [number, CreepName[]] {
    const spawnCreepProgress = this.spawnCreepObjective.progress(room, spawns)
    let spawnedCreeps = 0
    const canceledCreepNames: CreepName[] = []

    switch (spawnCreepProgress.objectProgressType) {
    case "in progress":
      if (spawnCreepProgress.value.spawnedCreepNames.length > 0) {
        this.workerObjective.didSpawnCreep(spawnCreepProgress.value.spawnedCreepNames)
        spawnedCreeps = spawnCreepProgress.value.spawnedCreepNames.length
      }
      if (spawnCreepProgress.value.canceledCreepNames.length > 0) {
        this.workerObjective.didCancelCreep(spawnCreepProgress.value.canceledCreepNames)
        canceledCreepNames.push(...spawnCreepProgress.value.canceledCreepNames)
      }
      break

    case "failed":
      if (spawnCreepProgress.reason.queuedCreepNames.length > 0) {
        this.workerObjective.didCancelCreep(spawnCreepProgress.reason.queuedCreepNames)
        canceledCreepNames.push(...spawnCreepProgress.reason.queuedCreepNames)
      }
      break
    }

    return [spawnedCreeps, canceledCreepNames]
  }
}
