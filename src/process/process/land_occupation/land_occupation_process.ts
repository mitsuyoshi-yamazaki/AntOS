import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { generateCodename, UniqueId } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { CreepName } from "prototype/creep"
import { Position } from "shared/utility/position"
import { processLog } from "os/infrastructure/logger"
import type { Timestamp } from "shared/utility/timestamp"
import { CreepBody } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { OperatingSystem } from "os/os"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { GameMap } from "game/game_map"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { ClaimControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/claim_controller_api_wrapper"
import { decodeRoomPosition, RoomPositionFilteringOptions } from "prototype/room_position"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { ClusterPlan, deserializePosition, fetchClusterData } from "./land_occupation_datamodel"
import { MessageObserver } from "os/infrastructure/message_observer"
import { BuildWallApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_wall_api_wrapper"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"

type RoomStateUnoccupied = {
  readonly case: "unoccupied"
  claimerName: CreepName | null
}
type RoomStateOccupied = {
  readonly case: "occupied"
  level: number

  readonly mainSourceCluster: {
    harvesterName: CreepName | null
  }
  readonly controllerCluster: {
    upgraderName: CreepName | null
  }

  workerNames: CreepName[]
  haulerName: CreepName | null
}
type RoomState = RoomStateUnoccupied | RoomStateOccupied

type HostileInfo = {
  readonly attacking: Id<Creep> | null
  readonly creeps: {
    [CreepId: string]: {
      readonly creepType: "attacker" | "worker"
      readonly healPower: number
    }
  }
}

type WallPositions = {
  readonly mainRampart: Position[]
  readonly controllerRampart: Position
  readonly controllerWall: Position[]
}

ProcessDecoder.register("LandOccupationProcess", state => {
  return LandOccupationProcess.decode(state as LandOccupationProcessState)
})

interface LandOccupationProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly parentRoomName: RoomName
  readonly mainSourcePlan: ClusterPlan
  readonly controllerPlan: ClusterPlan
  readonly roomState: RoomState
}

export class LandOccupationProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string
  private claimerBody: BodyPartConstant[] | null = null
  private workerBody: BodyPartConstant[] | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
    private readonly mainSourcePlan: ClusterPlan,
    private readonly controllerPlan: ClusterPlan,
    private roomState: RoomState,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): LandOccupationProcessState {
    return {
      t: "LandOccupationProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      parentRoomName: this.parentRoomName,
      roomState: this.roomState,
      mainSourcePlan: this.mainSourcePlan,
      controllerPlan: this.controllerPlan,
    }
  }

  public static decode(state: LandOccupationProcessState): LandOccupationProcess {
    return new LandOccupationProcess(
      state.l,
      state.i,
      state.roomName,
      state.parentRoomName,
      state.mainSourcePlan,
      state.controllerPlan,
      state.roomState,
    )
  }

  public static create(
    processId: ProcessId,
    roomName: RoomName,
    parentRoomName: RoomName,
    mainSourcePlan: ClusterPlan,
    controllerPlan: ClusterPlan,
  ): LandOccupationProcess {
    if (Memory.ignoreRooms.includes(roomName) !== true) {
      Memory.ignoreRooms.push(roomName)
    }

    const roomState: RoomStateUnoccupied = {
      case: "unoccupied",
      claimerName: null,
    }

    return new LandOccupationProcess(
      Game.time,
      processId,
      roomName,
      parentRoomName,
      mainSourcePlan,
      controllerPlan,
      roomState,
    )
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)}`,
      `parent: ${roomLink(this.parentRoomName)}`,
      this.describeCurrentState(),
    ]

    return descriptions.join(", ")
  }

  private describeCurrentState(): string {
    switch (this.roomState.case) {
    case "unoccupied":
      if (this.roomState.claimerName != null) {
        return `claiming: ${this.roomState.claimerName}`
      }
      return "unoccupied"
    case "occupied":
      if (this.roomState.workerNames.length > 0) {
        return "building"
      }
      return "working"
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.roomState
      return "unexpected state"
    }
    }
  }

  public processDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)}`,
      `parent: ${roomLink(this.parentRoomName)}`,
      this.describeCurrentState(),
    ]

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "status":
        return this.showStatus()
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  private showStatus(): string {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      return `${coloredText("[No room visual]", "warn")} ${this.processDescription() }`
    }

    const visuals: { position: Position, text: string }[] = []
    switch (this.roomState.case) {
    case "unoccupied":
      break
    case "occupied":
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.roomState
      break
    }
    }

    visuals.push({
      position: this.mainSourcePlan.center,
      text: "X",
    })
    visuals.push(...Array.from(Object.entries(this.mainSourcePlan.plan)).map(([serializedPosition, structureType]) => {
      return {
        position: deserializePosition(serializedPosition),
        text: (structureType[0] ?? "$").toUpperCase(),
      }
    }))
    visuals.push({
      position: this.controllerPlan.center,
      text: "X",
    })
    visuals.push(...Array.from(Object.entries(this.controllerPlan.plan)).map(([serializedPosition, structureType]) => {
      return {
        position: deserializePosition(serializedPosition),
        text: (structureType[0] ?? "$").toUpperCase(),
      }
    }))

    visuals.forEach(visual => {
      room.visual.text(visual.text, visual.position.x, visual.position.y)
    })

    return this.processDescription()
  }

  public runOnTick(): void {
    const room = Game.rooms[this.roomName]
    const controller = room?.controller

    switch (this.roomState.case) {
    case "unoccupied":
      if (controller?.my === true) {
        processLog(this, `${coloredText("[Info]", "info")} room occupied ${roomLink(this.roomName)}`)

        if (this.roomState.claimerName != null) {
          const claimer = Game.creeps[this.roomState.claimerName]
          claimer?.suicide()
        }
        this.destroyHostileStructures(controller.room)

        const occupiedRoomState: RoomStateOccupied = {
          case: "occupied",
          level: 0,
          mainSourceCluster: {
            harvesterName: null,
          },
          controllerCluster: {
            upgraderName: null,
          },
          workerNames: [],
          haulerName: null,
        }

        this.roomState = occupiedRoomState
        this.runOccupied(occupiedRoomState, controller)
        break

      }
      this.runUnoccupied(this.roomState, controller ?? null)
      break

    case "occupied":
      if (controller == null || controller.level <= 0) {
        processLog(this, `${coloredText("[WARN]", "warn")} room unoccupied ${roomLink(this.roomName)}`)

        const unoccupiedState: RoomStateUnoccupied = {
          case: "unoccupied",
          claimerName: null,
        }
        this.roomState = unoccupiedState
        this.runUnoccupied(this.roomState, controller ?? null)
        break
      }

      this.runOccupied(this.roomState, controller)
      break

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.roomState
      break
    }
    }
  }

  private destroyHostileStructures(room: Room): void {
    if (room.find(FIND_HOSTILE_CREEPS).length > 0) {
      PrimitiveLogger.notice(`${this.identifier} destroying structure failed in ${roomLink(room.name)}`)
      return
    }

    room.find(FIND_STRUCTURES).forEach(structure => {
      if ((structure as {my?: boolean}).my === true) {
        return
      }
      switch (structure.structureType) {
      case STRUCTURE_CONTAINER:
        if (structure.pos.isEqualTo(this.mainSourcePlan.center.x, this.mainSourcePlan.center.y) === true) {
          return
        }
        if (structure.pos.isEqualTo(this.controllerPlan.center.x, this.controllerPlan.center.y) === true) {
          return
        }
        break
      case STRUCTURE_CONTROLLER:
        return
      default:
        break
      }
      structure.destroy()
    })
  }

  private runUnoccupied(roomState: RoomStateUnoccupied, controller: StructureController | null): void {
    const claimer = ((): Creep | null => {
      if (roomState.claimerName == null) {
        return null
      }
      const creep = Game.creeps[roomState.claimerName]
      if (creep != null) {
        return creep
      }
      roomState.claimerName = null
      return null
    })()

    if (claimer == null) {
      const parentRoomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
      if (parentRoomResource == null) {
        PrimitiveLogger.fatal(`${coloredText("[ERROR]", "error")} ${this.identifier} no parent room found ${roomLink(this.parentRoomName)}`)
        OperatingSystem.os.suspendProcess(this.processId)
        return
      }

      const body = ((): BodyPartConstant[] => {
        if (this.claimerBody == null) {
          this.claimerBody = CreepBody.create([], [MOVE, CLAIM], parentRoomResource.room.energyCapacityAvailable, 4)
        }
        return this.claimerBody
      })()

      roomState.claimerName = this.spawnCreep(body)
    } else {
      this.runClaimer(claimer)
    }
  }

  private runClaimer(creep: Creep): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.roomName) ?? []
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.roomName, waypoints))
      return
    }

    if (creep.room.controller == null) {
      creep.say("no ctrl")
      return
    }
    creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(ClaimControllerApiWrapper.create(creep.room.controller, "blockade🚫")))
  }

  private spawnCreep(body: BodyPartConstant[]): CreepName {
    const creepName = UniqueId.generateCreepName(this.codename)

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body,
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
      name: creepName,
    })

    return creepName
  }

  private runOccupied(roomState: RoomStateOccupied, controller: StructureController): void {
    const workers = ((): Creep[] => {
      const creeps: Creep[] = []
      roomState.workerNames = roomState.workerNames.filter(creepName => {
        const creep = Game.creeps[creepName]
        if (creep == null) {
          return false
        }
        creeps.push(creep)
        return true
      })
      return creeps
    })()

    const waitingWorkers = workers.filter(creep => creep.v5task == null)
    if (waitingWorkers.length <= 0 && workers.length >= 4) {
      return
    }

    const [mainClusterData,] = fetchClusterData(controller, this.mainSourcePlan)  // TODO: キャッシュする

    if ((mainClusterData.structures[STRUCTURE_SPAWN] ?? []).length <= 0) {
      const parentRoomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
      if (parentRoomResource == null) {
        PrimitiveLogger.fatal(`${coloredText("[ERROR]", "error")} ${this.identifier} no parent room found ${roomLink(this.parentRoomName)}`)
        OperatingSystem.os.suspendProcess(this.processId)
        return
      }

      const body = ((): BodyPartConstant[] => {
        if (this.workerBody == null) {
          this.workerBody = CreepBody.create([], [WORK, CARRY, MOVE, MOVE], parentRoomResource.room.energyCapacityAvailable, 5)
        }
        return this.workerBody
      })()

      roomState.workerNames.push(this.spawnCreep(body))
    }

    if (waitingWorkers.length <= 0) {
      return
    }

    const [controllerClusterData,] = fetchClusterData(controller, this.controllerPlan)

    const constructionSite = ((): ConstructionSite<BuildableStructureConstant> | null => {
      return mainClusterData.constructionSite ?? controllerClusterData.constructionSite
    })()

    const sources = controller.room.find(FIND_SOURCES_ACTIVE)

    waitingWorkers.forEach(creep => this.runWorker(creep, controller, constructionSite, sources))
  }

  private runWorker(creep: Creep, controller: StructureController, constructionSite: ConstructionSite<BuildableStructureConstant> | null, sources: Source[]): void {
    // if (creep.v5task != null) {  // 事前にfilterしてある想定
    //   return
    // }

    if (creep.room.name !== this.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.roomName) ?? []
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.roomName, waypoints))
      return
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      // const tower = this.getTower(roomState)
      // if (tower != null && tower.store.getFreeCapacity(RESOURCE_ENERGY) > 50) {
      //   creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(TransferEnergyApiWrapper.create(tower)))
      //   return
      // }

      if (constructionSite != null) {
        if (constructionSite.structureType === STRUCTURE_RAMPART) {
          creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(BuildWallApiWrapper.create(constructionSite as ConstructionSite<STRUCTURE_RAMPART>)))
          return
        }
        creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(BuildApiWrapper.create(constructionSite)))
        return
      }

      creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(UpgradeControllerApiWrapper.create(controller)))
      return
    }

    const source = sources[0]
    if (source == null) {
      creep.say("no task")
      return
    }

    creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source)))
    return
  }

  // private updateConstructionSite(roomState: RoomStateOccupied, room: Room): { constructionSite: ConstructionSite<BuildableStructureTypes> | null } {
  //   if (roomState.constructingStructure == null) {
  //     return { constructionSite: null }
  //   }
  //   const constructionSite = Game.getObjectById(roomState.constructingStructure.constructionSiteId)
  //   if (constructionSite != null) {
  //     return { constructionSite }
  //   }

  //   switch (roomState.constructingStructure.structureType) {
  //   case STRUCTURE_SPAWN: {
  //     const spawn = room.find(FIND_MY_SPAWNS)[0]
  //     if (spawn == null) {
  //       roomState.queuedConstructionSites.push({
  //         position: this.roomPlan.mainSource.spawnPosition,
  //         structureType: STRUCTURE_SPAWN,
  //       })
  //       break
  //     }
  //     roomState.mainSource.spawnId = spawn.id
  //     break
  //   }
  //   case STRUCTURE_TOWER: {
  //     const tower = room.find(FIND_MY_STRUCTURES, {filter: {structureType: STRUCTURE_TOWER}})[0] as (StructureTower | null)
  //     if (tower == null) {
  //       roomState.queuedConstructionSites.push({
  //         position: this.roomPlan.mainSource.towerPosition,
  //         structureType: STRUCTURE_TOWER,
  //       })
  //       break
  //     }
  //     roomState.mainSource.towerId = tower.id
  //     break
  //   }
  //   case STRUCTURE_CONTAINER: {
  //     const containers = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } }) as StructureContainer[]
  //     const mainSourcePosition = this.roomPlan.mainSource.position
  //     const controllerPosition = this.roomPlan.controller.position

  //     containers.forEach(container => {
  //       if (container.pos.isEqualTo(mainSourcePosition.x, mainSourcePosition.y) === true) {
  //         roomState.mainSource.containerId = container.id
  //         return
  //       }
  //       if (container.pos.isEqualTo(controllerPosition.x, controllerPosition.y) === true) {
  //         roomState.controller.containerId = container.id
  //         return
  //       }
  //     })
  //     break
  //   }
  //   case STRUCTURE_RAMPART: {

  //   }
  //   case STRUCTURE_WALL:
  //   default: {
  //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //     const _: never = roomState.constructingStructure.structureType
  //     break
  //   }
  //   }

  //   roomState.constructingStructure = null
  //   return { constructionSite: null }
  // }

  // private getTower(roomState: RoomStateOccupied): StructureTower | null {
  //   if (roomState.mainSource.towerId == null) {
  //     return null
  //   }
  //   const structure = Game.getObjectById(roomState.mainSource.towerId)
  //   if (structure != null) {
  //     return structure
  //   }
  //   roomState.queuedConstructionSites.push({
  //     position: this.roomPlan.mainSource.towerPosition,
  //     structureType: STRUCTURE_TOWER,
  //   })
  //   roomState.queuedConstructionSites.push({
  //     position: this.roomPlan.mainSource.towerPosition,
  //     structureType: STRUCTURE_RAMPART,
  //   })
  //   roomState.mainSource.towerId = null
  //   return null
  // }

  // private getSpawn(roomState: RoomStateOccupied): StructureSpawn | null {
  //   if (roomState.mainSource.spawnId == null) {
  //     return null
  //   }
  //   const structure = Game.getObjectById(roomState.mainSource.spawnId)
  //   if (structure != null) {
  //     return structure
  //   }
  //   roomState.queuedConstructionSites.push({
  //     position: this.roomPlan.mainSource.spawnPosition,
  //     structureType: STRUCTURE_SPAWN,
  //   })
  //   roomState.queuedConstructionSites.push({
  //     position: this.roomPlan.mainSource.spawnPosition,
  //     structureType: STRUCTURE_RAMPART,
  //   })
  //   roomState.mainSource.spawnId = null
  //   return null
  // }

  private updateRoomState(roomState: RoomStateOccupied, controller: StructureController): void {
    // const destroyedStructures = controller.room.getEventLog().flatMap((event): {id: Id<AnyStructure>, structureType: StructureConstant}[] => {
    //   switch (event.event) {
    //   case EVENT_OBJECT_DESTROYED:
    //     if (event.data.type !== "creep") {
    //       return [{
    //         id: event.objectId as Id<AnyStructure>,
    //         structureType: event.data.type,
    //       }]
    //     }
    //     return []
    //   default:
    //     return []
    //   }
    // })

    // this.addConstructionSiteForDestroyedStructure(destroyedStructures, roomState, controller)

    // TODO: IDからチェックする

    if (controller.level > roomState.level) {
      switch (controller.level) {
      case 1:
      case 2:
        break
      case 3:
        // this.addRcl3Constructions(roomState, controller)
        break
      case 4:
      case 5:
      case 6:
      case 7:
      case 8:
      default:
        break
      }
    }
  }

  // private addConstructionSiteForDestroyedStructure(
  //   destroyedStructures: { id: Id<AnyStructure>, structureType: StructureConstant }[],
  //   roomState: RoomStateOccupied,
  //   controller: StructureController
  // ): void {

  //   const destroyedWallIds: Id<StructureRampart | StructureWall>[] = []

  //   destroyedStructures.forEach(data => {
  //     processLog(this, `${data.structureType} destroyed in ${roomLink(this.roomName)}`)

  //     switch (data.structureType) {
  //     case STRUCTURE_RAMPART:
  //       destroyedWallIds.push(data.id as Id<StructureRampart>)
  //       break

  //     case STRUCTURE_WALL:
  //       destroyedWallIds.push(data.id as Id<StructureWall>)
  //       break

  //     case STRUCTURE_SPAWN:
  //       roomState.mainSource.spawnId = null
  //       roomState.queuedConstructionSites.push({
  //         position: this.roomPlan.mainSource.spawnPosition,
  //         structureType: STRUCTURE_SPAWN,
  //       })
  //       break

  //     case STRUCTURE_TOWER:
  //       roomState.mainSource.towerId = null
  //       roomState.queuedConstructionSites.push({
  //         position: this.roomPlan.mainSource.towerPosition,
  //         structureType: STRUCTURE_TOWER,
  //       })
  //       break

  //     case STRUCTURE_CONTAINER:
  //       if ((data.id as Id<StructureContainer>) === roomState.mainSource.containerId) {
  //         roomState.mainSource.containerId = null
  //         roomState.queuedConstructionSites.push({
  //           position: this.roomPlan.mainSource.position,
  //           structureType: STRUCTURE_CONTAINER,
  //         })
  //       }
  //       if ((data.id as Id<StructureContainer>) === roomState.controller.containerId) {
  //         roomState.controller.containerId = null
  //         roomState.queuedConstructionSites.push({
  //           position: this.roomPlan.controller.position,
  //           structureType: STRUCTURE_CONTAINER,
  //         })
  //       }
  //       break

  //     default:
  //       break
  //     }
  //   })

  //   if (destroyedWallIds.length > 0) {
  //     if (this.wallPositions == null) {
  //       this.wallPositions = this.calculateWallPositions(controller)
  //     }

  //     // destroyedWallIds.forEach(destroyedId => {
  //     //   const mainSourceIndex = (roomState.mainSource.rampartIds as string[]).indexOf(destroyedId)
  //     //   if (mainSourceIndex >= 0) {

  //     //   }
  //     // })
  //   }
  // }

  // private calculateWallPositions(controller: StructureController): WallPositions {
  //   const positionOptions: RoomPositionFilteringOptions = {
  //     excludeItself: true,
  //     excludeStructures: false,
  //     excludeTerrainWalls: true,
  //     excludeWalkableStructures: false,
  //   }
  //   const mainSourcePosition = decodeRoomPosition(this.roomPlan.mainSource.position, controller.room.name)
  //   const mainRampart: Position[] = mainSourcePosition.positionsInRange(1, positionOptions)

  //   const controllerPosition = decodeRoomPosition(this.roomPlan.controller.position, controller.room.name)
  //   const controllerWall: Position[] = controller.pos.positionsInRange(1, positionOptions).filter(position => position.isEqualTo(controllerPosition) !== true)

  //   return {
  //     mainRampart,
  //     controllerRampart: controllerPosition,
  //     controllerWall,
  //   }
  // }
}

const getInitialHostileInfo = (room: Room): HostileInfo => {
  const creeps: {
    [CreepId: string]: {
      readonly creepType: "attacker" | "worker"
      readonly healPower: number
    }
  } = {}

  room.find(FIND_HOSTILE_CREEPS).forEach(creep => {
    if (Game.isEnemy(creep.owner) !== true) {
      return
    }
    const healPower = CreepBody.power(creep.body, "heal", {ignoreHits: true})
    const creepType = ((): "attacker" | "worker" => {
      if (healPower > 0) {
        return "attacker"
      }
      if (creep.body.some(body => body.type === ATTACK || body.type === RANGED_ATTACK || body.type === CLAIM) === true) {
        return "attacker"
      }
      return "worker"
    })()

    creeps[creep.id] = {
      healPower,
      creepType,
    }
  })

  return {
    attacking: null,
    creeps,
  }
}
