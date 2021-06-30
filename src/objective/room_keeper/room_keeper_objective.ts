import { ErrorMapper } from "error_mapper/ErrorMapper"
import { ClaimRoomObjective } from "objective/bootstrap_room/claim_room_objective"
import { OldBuildFirstSpawnObjective } from "objective/bootstrap_room/old_build_first_spawn_objective"
import { DefendOwnedRoomObjective } from "objective/defend_room/defend_owned_room_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveState } from "objective/objective"
import { SpawnCreepObjective } from "objective/spawn/spawn_creep_objective"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"
import { EnergyChargeableStructure } from "prototype/room_object"
import { roomLink } from "utility/log"
import { CreepType } from "_old/creep"
import { PrimitiveWorkerObjective } from "objective/worker/primitive_worker_objective"
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
  private readonly workerObjective: PrimitiveWorkerObjective // TODO: RCLごとに実行するobjectiveを切り替える
  private buildFirstSpawnObjective: OldBuildFirstSpawnObjective | null
  private defendRoomObjective: DefendOwnedRoomObjective | null
  private claimRoomObjective: ClaimRoomObjective | null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly roomName: RoomName,
    takenOverWorkerNames: CreepName[],
  ) {
    let spawnCreepObjective: SpawnCreepObjective | null = null
    let workerObjective: PrimitiveWorkerObjective | null = null
    let defendRoomObjective: DefendOwnedRoomObjective | null = null
    let buildFirstSpawnObjective: OldBuildFirstSpawnObjective | null = null
    let claimRoomObjective: ClaimRoomObjective | null = null
    children.forEach(child => {
      if (child instanceof SpawnCreepObjective) {
        spawnCreepObjective = child
        return
      }
      if (child instanceof PrimitiveWorkerObjective) {
        workerObjective = child
        return
      }
      if (child instanceof DefendOwnedRoomObjective) {
        defendRoomObjective = child
        return
      }
      if (child instanceof OldBuildFirstSpawnObjective) {
        buildFirstSpawnObjective = child
        return
      }
      if (child instanceof ClaimRoomObjective) {
        claimRoomObjective = child
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
    this.workerObjective = ((): PrimitiveWorkerObjective => {
      if (workerObjective != null) {
        return workerObjective
      }
      const newObjective = new PrimitiveWorkerObjective(Game.time, [], [], [], null)
      this.children.push(newObjective)
      return newObjective
    })()
    this.defendRoomObjective = defendRoomObjective
    this.buildFirstSpawnObjective = buildFirstSpawnObjective
    this.claimRoomObjective = claimRoomObjective

    this.workerObjective.addCreeps(takenOverWorkerNames)
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
    return new RoomKeeperObjective(state.s, children, state.r, [])
  }

  public claimRoom(targetRoomName: RoomName): void {
    const objective = new ClaimRoomObjective(Game.time, [], targetRoomName, null, false)
    this.children.push(objective)
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

    if (roomObjects.activeStructures.spawns.length <= 0) {  // TODO: downgradeした場合を考慮していない
      let buildFirstSpawnStatus = null as string | null
      ErrorMapper.wrapLoop((): void => {
        buildFirstSpawnStatus = this.buildFirstSpawn(room)
      }, "RoomKeeperObjective.buildFirstSpawn()")()
      const event: RoomKeeperObjectiveEvents = {
        spawnedCreeps: 0,
        canceledCreepNames: [],
        status: buildFirstSpawnStatus ?? "program bug",
      }
      return new ObjectiveInProgress(event)
    } else {
      if (this.buildFirstSpawnObjective != null) {
        this.workerObjective.addCreeps(this.buildFirstSpawnObjective.workerNames)
        this.removeBuildFirstSpawnObjective(this.buildFirstSpawnObjective)
      }
    }

    let status = ""

    if (this.claimRoomObjective != null) {
      const claimRoomObjective = this.claimRoomObjective
      ErrorMapper.wrapLoop((): void => {
        status += this.runClaimRoomObjective(claimRoomObjective)
      }, "RoomKeeperObjective.claimRoom()") ()
    }

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
        roomObjects.constructionSites,
        roomObjects.activeStructures.damagedStructures,
        roomObjects.idleCreeps,
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

    if (roomObjects.constructionSites.length <= 0 && roomObjects.flags.length > 0) {
      ErrorMapper.wrapLoop((): void => {
        this.placeConstructionSite(room, roomObjects.flags)
      }, "RoomKeeperObjective.placeConstructionSite()")()
    }

    return new ObjectiveInProgress(event)
  }

  // ---- Private ---- //
  private runWorker(
    sources: Source[],
    chargeableStructures: EnergyChargeableStructure[],
    controller: StructureController,
    constructionSites: ConstructionSite<BuildableStructureConstant>[],
    damagedStructures: AnyOwnedStructure[],
    idleCreeps: Creep[],
  ): string {

    this.workerObjective.addCreeps(idleCreeps.map(creep => creep.name))

    const workerProgress = this.workerObjective.progress(sources, chargeableStructures, controller, constructionSites, damagedStructures, this.spawnCreepObjective)
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

  private buildFirstSpawn(room: Room): string {
    const buildFirstSpawnObjective = ((): OldBuildFirstSpawnObjective => {
      if (this.buildFirstSpawnObjective != null) {
        return this.buildFirstSpawnObjective
      }
      const takenOverCreeps: Creep[] = room.find(FIND_MY_CREEPS)
        .filter(creep => creep.memory.type === CreepType.TAKE_OVER)

      takenOverCreeps.forEach(creep => creep.memory.type = CreepType.WORKER)
      const takenOverCreepNames = takenOverCreeps.map(creep => creep.name)

      const objective = new OldBuildFirstSpawnObjective(Game.time, [], takenOverCreepNames, [])
      this.buildFirstSpawnObjective = objective
      this.children.push(objective)
      return objective
    })()

    const parentRooms: {[index: string]: string} = { // TODO:
      W51S37: "W53S36",
      W51S29: "W51S29",
    }
    const parentRoomName = parentRooms[room.name]
    if (parentRoomName == null) {
      PrimitiveLogger.fatal(`BuildFirstSpawnObjective with room ${roomLink(room.name)} is not implemented yet`)
      return "Not implemented yet"
    }
    const progress = buildFirstSpawnObjective.progress(room, parentRoomName)
    switch (progress.objectProgressType) {
    case "in progress":
      return progress.value
    case "succeeded":
      this.removeBuildFirstSpawnObjective(buildFirstSpawnObjective)
      return `Spawn ${progress.result.name} built in ${roomLink(room.name)}`
    case "failed":
      this.removeBuildFirstSpawnObjective(buildFirstSpawnObjective)
      return progress.reason
    }
  }

  private removeBuildFirstSpawnObjective(objective: OldBuildFirstSpawnObjective): void {
    this.buildFirstSpawnObjective = null
    const index = this.children.indexOf(objective)
    if (index >= 0) {
      this.children.splice(index, 1)
    }
  }

  private runClaimRoomObjective(claimRoomObjective: ClaimRoomObjective): string {
    const progress = claimRoomObjective.progress(this.spawnCreepObjective)
    switch (progress.objectProgressType) {
    case "in progress":
      return progress.value
    case "succeeded":
      this.removeClaimRoomObjective(claimRoomObjective)
      return `Room ${roomLink(progress.result.room.name)} successfully claimed`
    case "failed":
      this.removeClaimRoomObjective(claimRoomObjective)
      return progress.reason
    }
  }

  private removeClaimRoomObjective(objective: ClaimRoomObjective): void {
    this.claimRoomObjective = null
    const index = this.children.indexOf(objective)
    if (index >= 0) {
      this.children.splice(index, 1)
    }
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
    this.defendRoomObjective = null
    const index = this.children.indexOf(defendRoomObjective)
    if (index >= 0) {
      this.children.splice(index, 1)
    }
  }

  private runCreepSpawn(room: Room, spawns: StructureSpawn[]): [number, CreepName[]] {
    this.retrieveQueuedRequests()

    const spawnCreepProgress = this.spawnCreepObjective.progress(room, spawns)
    let spawnedCreeps = 0
    const canceledCreepNames: CreepName[] = []

    switch (spawnCreepProgress.objectProgressType) {
    case "in progress":
      if (spawnCreepProgress.value.spawnedCreepNames.length > 0) {
        this.workerObjective.didSpawnCreep(spawnCreepProgress.value.spawnedCreepNames)
        this.claimRoomObjective?.didSpawnCreep(spawnCreepProgress.value.spawnedCreepNames)
        spawnedCreeps = spawnCreepProgress.value.spawnedCreepNames.length
      }
      if (spawnCreepProgress.value.canceledCreepNames.length > 0) {
        this.workerObjective.didCancelCreep(spawnCreepProgress.value.canceledCreepNames)
        this.claimRoomObjective?.didCancelCreep(spawnCreepProgress.value.canceledCreepNames)
        canceledCreepNames.push(...spawnCreepProgress.value.canceledCreepNames)
      }
      break

    case "failed":
      if (spawnCreepProgress.reason.queuedCreepNames.length > 0) {
        this.workerObjective.didCancelCreep(spawnCreepProgress.reason.queuedCreepNames)
        this.claimRoomObjective?.didCancelCreep(spawnCreepProgress.reason.queuedCreepNames)
        canceledCreepNames.push(...spawnCreepProgress.reason.queuedCreepNames)
      }
      break
    }

    return [spawnedCreeps, canceledCreepNames]
  }

  private retrieveQueuedRequests(): void {
    const queue = Memory.creepRequests[this.roomName]
    if (queue == null) {
      return
    }
    queue.forEach(item => {
      this.spawnCreepObjective.enqueueCreep(item.n, item.b, item.m, item.p)
    })
    Memory.creepRequests[this.roomName] = []
  }

  private placeConstructionSite(room: Room, flags: Flag[]): void {
    const colorMap = new Map<ColorConstant, StructureConstant>([
      [COLOR_BROWN, STRUCTURE_ROAD],
      [COLOR_GREEN, STRUCTURE_STORAGE],
      [COLOR_PURPLE, STRUCTURE_TERMINAL],
      [COLOR_ORANGE, STRUCTURE_LINK],
      [COLOR_BLUE, STRUCTURE_LAB],
      [COLOR_RED, STRUCTURE_TOWER],
      [COLOR_GREY, STRUCTURE_SPAWN],
      [COLOR_CYAN, STRUCTURE_NUKER],
      [COLOR_WHITE, STRUCTURE_EXTENSION],
    ])

    for (const flag of flags) {
      const structureType = colorMap.get(flag.color)
      if (structureType == null) {
        continue
      }
      const result = room.createConstructionSite(flag.pos, structureType)
      switch (result) {
      case OK:
        flag.remove()
        return
      case ERR_NOT_OWNER:
      case ERR_INVALID_TARGET:
      case ERR_INVALID_ARGS:
        flag.remove()
        break
      case ERR_FULL:
      case ERR_RCL_NOT_ENOUGH:
        break
      }
    }
  }
}
