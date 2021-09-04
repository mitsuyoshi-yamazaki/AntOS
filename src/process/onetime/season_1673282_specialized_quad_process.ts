import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { isRoomName, RoomCoordinate, RoomName } from "utility/room_name"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "os/infrastructure/logger"
import { MessageObserver } from "os/infrastructure/message_observer"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { BoostApiWrapper } from "v5_object_task/creep_task/api_wrapper/boost_api_wrapper"
import { OperatingSystem } from "os/os"
import { Quad, QuadAttackTargetType, QuadState } from "./season_1673282_specialized_quad"
import { QuadSpec, QuadType } from "./season_1673282_specialized_quad_spec"
import { CreepName } from "prototype/creep"
import { GameConstants } from "utility/constants"
import { boostableCreepBody } from "utility/resource"
import { RoomResources } from "room_resource/room_resources"
import { Season1143119LabChargerProcess, Season1143119LabChargerProcessLabInfo } from "./season_1143119_lab_charger_process"
import { directionName } from "utility/direction"

type AttackTarget = AnyCreep | AnyStructure
type ManualOperations = {
  targetIds: Id<AttackTarget>[]
  direction: TOP | BOTTOM | LEFT | RIGHT | null
  action: "flee" | "noflee" | "drain" | null
  message: string | null
  automaticRotationEnabled: boolean | null
}

type TargetRoomInfo = {
  readonly roomName: RoomName
  readonly waypoints: RoomName[]
}

export interface Season1673282SpecializedQuadProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  targetRoomName: RoomName
  waypoints: RoomName[]
  quadType: QuadType
  creepNames: CreepName[]
  quadState: QuadState | null
  manualOperations: ManualOperations
  // lastTowerAttack: // TODO:
  nextTargets: TargetRoomInfo[]
}

// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W48S6 target_room_name=W46S7 waypoints=W48S7 quad_type=tier1-invader-core-lv1 targets=")
export class Season1673282SpecializedQuadProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string

  private readonly codename: string
  private readonly quadSpec: QuadSpec

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public targetRoomName: RoomName,
    public waypoints: RoomName[],
    private readonly quadType: QuadType,
    private readonly creepNames: CreepName[],
    private quadState: QuadState | null,
    private readonly manualOperations: ManualOperations,
    private readonly nextTargets: TargetRoomInfo[],
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    this.quadSpec = new QuadSpec(this.quadType)
  }

  public encode(): Season1673282SpecializedQuadProcessState {
    return {
      t: "Season1673282SpecializedQuadProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomName: this.targetRoomName,
      waypoints: this.waypoints,
      quadType: this.quadType,
      creepNames: this.creepNames,
      quadState: this.quadState,
      manualOperations: this.manualOperations,
      nextTargets: this.nextTargets,
    }
  }

  public static decode(state: Season1673282SpecializedQuadProcessState): Season1673282SpecializedQuadProcess {
    return new Season1673282SpecializedQuadProcess(state.l, state.i, state.p, state.targetRoomName, state.waypoints, state.quadType, state.creepNames, state.quadState, state.manualOperations, state.nextTargets ?? [])
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], predefinedTargetIds: Id<AttackTarget>[], quadType: QuadType): Season1673282SpecializedQuadProcess {
    const quadSpec = new QuadSpec(quadType)
    if (quadSpec.boosts.length > 0) {
      launchLabChargerProcess(parentRoomName, quadSpec)
    }
    const manualOperations: ManualOperations = {
      targetIds: predefinedTargetIds,
      direction: null,
      action: null,
      message: null,
      automaticRotationEnabled: null,
    }
    return new Season1673282SpecializedQuadProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, quadType, [], null, manualOperations, [])
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    return `${roomLink(this.parentRoomName)} => ${roomLink(this.targetRoomName)} ${creepCount}cr ${this.quadType}`
  }

  public didReceiveMessage(message: string): string {
    if (message === "clear") {
      this.manualOperations.targetIds.splice(0, this.manualOperations.targetIds.length)
      return "target cleared"
    }
    if (message === "status") {
      const descriptions: string[] = [
        `targets: ${roomLink(this.targetRoomName)},${this.nextTargets.map(n => roomLink(n.roomName)).join(",")}`,
        (this.quadState == null ? "no quad" : `direction: ${this.quadState.direction}`),
        (this.manualOperations.targetIds.length <= 0 ? "no targets" : `targets: ${this.manualOperations.targetIds.join(",")}`),
      ]
      if (this.manualOperations.action != null) {
        descriptions.unshift(`action: ${this.manualOperations.action}`)
      }
      // descriptions.push(`in ${roomLink()}`)
      return descriptions.join(", ")
    }
    if (message === "flee") {
      this.manualOperations.action = "flee"
      return "action: flee"
    }
    if (message === "noflee") {
      this.manualOperations.action = "noflee"
      return "action: noflee"
    }
    if (message === "drain") {
      this.manualOperations.action = "drain"
      return "action: drain"
    }
    if (message === "clear action") {
      this.manualOperations.action = null
      this.manualOperations.message = null
      return "action cleared"
    }
    if (message.startsWith("say ")) {
      const squadMessage = message.slice(4)
      if (squadMessage.length > 0) {
        this.manualOperations.message = squadMessage
        return `set message "${squadMessage}"`
      }
      this.manualOperations.message = null
      return "clear message"
    }
    if (message === "enable rotation") {
      if (this.quadState != null) {
        this.quadState.automaticRotationEnabled = true
      } else {
        this.manualOperations.automaticRotationEnabled = true
      }
      return "automatic rotation enabled"
    }
    if (message === "disable rotation") {
      if (this.quadState != null) {
        this.quadState.automaticRotationEnabled = false
      } else {
        this.manualOperations.automaticRotationEnabled = false
      }
      return "automatic rotation disabled"
    }
    const direction = parseInt(message, 10)
    if (message.length <= 1 && isNaN(direction) !== true && ([TOP, BOTTOM, RIGHT, LEFT] as number[]).includes(direction) === true) {
      if (this.quadState == null) {
        if (this.creepNames.length > 0) {
          return "quad died"
        } else {
          this.manualOperations.direction = direction as TOP | BOTTOM | RIGHT | LEFT
          return `direction ${coloredText(directionName(direction as TOP | BOTTOM | RIGHT | LEFT), "info")} set`
        }
      }
      this.quadState.nextDirection = direction as TOP | BOTTOM | RIGHT | LEFT
      return `direction ${coloredText(directionName(direction as TOP | BOTTOM | RIGHT | LEFT), "info")} set`
    }
    const parseTargetRoomInfo = (rawInfo: string): TargetRoomInfo | string => {
      const roomNames = rawInfo.split(",")
      if (rawInfo.length <= 0 || roomNames.length <= 0) {
        return "no target room specified"
      }
      if (roomNames.some(roomName => !isRoomName(roomName)) === true) {
        return `invalid room name ${roomNames}`
      }
      const targetRoomName = roomNames.pop()
      if (targetRoomName == null) {
        return "can't retrieve target room"
      }
      return {
        roomName: targetRoomName,
        waypoints: roomNames,
      }
    }
    const changeTargetCommand = "change target "
    if (message.startsWith(changeTargetCommand)) {
      const rawRooms = message.slice(changeTargetCommand.length)
      const roomInfo = parseTargetRoomInfo(rawRooms)
      if (typeof roomInfo === "string") {
        return roomInfo
      }
      this.waypoints = roomInfo.waypoints
      this.targetRoomName = roomInfo.roomName
      const nextTargetsInfo = this.nextTargets.length > 0 ? `, ${this.nextTargets.length} following targets cleared` : ""
      this.nextTargets.splice(0, this.nextTargets.length)
      return `target room: ${roomInfo.roomName}, waypoints: ${roomInfo.waypoints} set${nextTargetsInfo}`
    }
    const addTargetCommand = "add target "
    if (message.startsWith(addTargetCommand)) {
      const rawRooms = message.slice(addTargetCommand.length)
      const roomInfo = parseTargetRoomInfo(rawRooms)
      if (typeof roomInfo === "string") {
        return roomInfo
      }
      this.nextTargets.push(roomInfo)
      return `target room: ${roomInfo.roomName}, waypoints: ${roomInfo.waypoints} added`
    }
    if (message.length <= 0) {
      return "Empty message"
    }
    this.manualOperations.targetIds.unshift(message as Id<AnyStructure | AnyCreep>)
    return `target ${message} set`
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      return
    }

    if (this.quadState != null && this.manualOperations.direction != null) {
      this.quadState.nextDirection = this.manualOperations.direction
    }

    let quad = ((): Quad | null => {
      if (this.quadState == null) {
        return null
      }
      return Quad.decode(this.quadState)
    })()

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    creeps.forEach(creep => {
      if (this.creepNames.includes(creep.name) !== true) {
        this.creepNames.push(creep.name)
      }
      if (this.isBoosted(creep) !== true) {
        if (creep.v5task != null) {
          return
        }
        this.boostCreep(creep)
        return
      }
      if (quad == null) {
        quad = Quad.create(creep, [])
        return
      }
      if (quad.includes(creep.name) !== true) {
        quad.addCreep(creep)
      }
    })

    const priority = ((): CreepSpawnRequestPriority => {
      if (this.quadType === "test-dismantler") {
        return CreepSpawnRequestPriority.High
      }
      if (quad == null) {
        return CreepSpawnRequestPriority.Low
      }
      return CreepSpawnRequestPriority.Urgent
    })()
    const squadCreepCount = this.quadSpec.creepCount()
    const creepInsufficiency = squadCreepCount - this.creepNames.length
    if (creepInsufficiency > 0) {
      if (this.creepNames.length <= 0 && this.isLabReady(resources.room) !== true) {
        processLog(this, `Labs not ready ${roomLink(this.parentRoomName)}`)
        return
      }
      const spec = this.quadSpec.creepSpecFor(creepInsufficiency)
      this.requestCreep(priority, creepInsufficiency, spec.roles, spec.body)
    }

    if (quad != null) {
      const isPreparing = ((): boolean => {
        const creepCount = this.quadSpec.creepCount()
        if (quad.numberOfCreeps >= creepCount) {
          return false
        }
        if (quad.numberOfCreeps < creeps.length) {
          return true
        }
        if (this.creepNames.length < creepCount) {
          return true
        }
        return false
      })()
      quad.beforeRun()
      if (isPreparing === true) {
        quad.moveToRoom(this.targetRoomName, this.waypoints, {wait: true})
        quad.heal()
      } else {
        this.runQuad(quad)
      }
      quad.run()
      if (this.manualOperations.message != null) {
        quad.say(this.manualOperations.message, true)
      }
      if (this.manualOperations.automaticRotationEnabled != null) {
        quad.automaticRotationEnabled = this.manualOperations.automaticRotationEnabled
        this.manualOperations.automaticRotationEnabled = null
      }
      this.quadState = quad.encode()
      const roomInfo = ` in ${roomLink(quad.pos.roomName)}`
      processLog(this, `${quad.numberOfCreeps}creeps${roomInfo}`)
      return
    }
    this.quadState = null

    if (this.creepNames.length > 0 && creeps.length <= 0) {
      processLog(this, "Quad dead")
      OperatingSystem.os.killProcess(this.processId)
      return
    }
    if (creeps.length <= 0) {
      processLog(this, "No creeps")
    } else {
      processLog(this, `${creeps.length} unboosted creeps`)
    }
  }

  private requestCreep(priority: CreepSpawnRequestPriority, numberOfCreeps: number, roles: CreepRole[], body: BodyPartConstant[]): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles,
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runQuad(quad: Quad): void {
    if (quad.inRoom(this.targetRoomName) !== true) {
      if (this.manualOperations.action === "flee" && quad.allCreepsInSameRoom() === true) {
        this.manualOperations.action = null
      }
      quad.moveToRoom(this.targetRoomName, this.waypoints, { backward: false, healBeforeEnter: true })
      quad.passiveAttack(this.hostileCreepsInRoom(quad.room))
      quad.heal()
      return
    }

    if (quad.room.name === this.targetRoomName && quad.room.controller != null && quad.room.controller.safeMode != null) {
      const { succeeded } = this.flee(quad)
      if (succeeded === true) {
        return
      }
    }

    if (this.manualOperations.action !== "noflee" && quad.damagePercent * 4 > 0.15) {
      const { succeeded } = this.flee(quad)
      if (succeeded === true) {
        return
      }
    }

    switch (this.manualOperations.action) {
    case "flee": {
      const { succeeded } = this.flee(quad)
      if (succeeded === true) {
        return
      }
      break
    }
    case "noflee":
      break
    case "drain":
      if (this.towerCharged(quad.room) === true) {
        this.drain(quad)
        return
      }
      break
    }

    const { mainTarget, optionalTargets, mainObjectiveAchieved } = this.attackTargets(quad)
    if (mainObjectiveAchieved === true) {
      const nextTargetInfo = this.nextTargets.shift()
      if (nextTargetInfo != null) {
        processLog(this, `${coloredText("[Quad]", "warn")} target ${roomLink(this.targetRoomName)} finished, heading to ${roomLink(nextTargetInfo.roomName)}`)
        this.targetRoomName = nextTargetInfo.roomName
        this.waypoints = nextTargetInfo.waypoints
      }
    }

    if (mainTarget == null && optionalTargets.length <= 0) {
      const damagedCreeps = this.damagedMyCreepsInRoom(quad)
      const closestDamagedCreep = quad.pos.findClosestByPath(damagedCreeps)
      if (closestDamagedCreep != null) {
        quad.moveTo(closestDamagedCreep.pos, 1)
      }
      quad.heal(damagedCreeps)
      return
    }

    quad.heal()
    quad.attack(mainTarget, optionalTargets)
    if (mainTarget != null) {
      if (this.quadSpec.canHandleMelee() !== true && (mainTarget instanceof Creep) && mainTarget.getActiveBodyparts(ATTACK) > 0) {
        if (quad.getMinRangeTo(mainTarget.pos) <= 1) {
          quad.fleeFrom(mainTarget.pos, 2)
        } else {
          quad.moveTo(mainTarget.pos, 2)
        }
      } else {
        quad.moveTo(mainTarget.pos, 1)
      }
      return
    }
    quad.keepQuadForm()
  }

  private flee(quad: Quad): { succeeded: boolean } {
    const closestNeighbourRoom = this.closestNeighbourRoom(quad.pos)
    if (closestNeighbourRoom == null) {
      return { succeeded: false }
    }
    quad.moveToRoom(closestNeighbourRoom, [], {quadFormed: true})
    quad.passiveAttack(this.hostileCreepsInRoom(quad.room))
    quad.heal()
    return { succeeded: true }
  }

  private towerCharged(room: Room): boolean {
    const chargedTowers: StructureTower[] = []
    const emptyTowers: StructureTower[] = []
    room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })
      .forEach(tower => {
        if (!(tower instanceof StructureTower)) {
          return
        }
        if (tower.store.getUsedCapacity(RESOURCE_ENERGY) <= 50) {
          emptyTowers.push(tower)
        } else {
          chargedTowers.push(tower)
        }
      })

    if (chargedTowers.length <= 0) {
      return false
    }
    return chargedTowers.length > emptyTowers.length
  }

  private drain(quad: Quad): void {
    quad.say("drain")
    quad.heal()
    quad.passiveAttack(this.hostileCreepsInRoom(quad.room))

    const quadPosition = quad.pos
    const threshold = 3
    const min = GameConstants.room.edgePosition.min + threshold
    const max = GameConstants.room.edgePosition.max - threshold
    if (quadPosition.x < min) {
      quad.keepQuadForm()
      return
    }
    if (quadPosition.x > max) {
      quad.keepQuadForm()
      return
    }
    if (quadPosition.y < min) {
      quad.keepQuadForm()
      return
    }
    if (quadPosition.y > max) {
      quad.keepQuadForm()
      return
    }

    const closestNeighbourRoom = this.closestNeighbourRoom(quad.pos)
    if (closestNeighbourRoom == null) {
      quad.keepQuadForm()
      return
    }
    quad.moveToRoom(closestNeighbourRoom, [], { quadFormed: true })
  }

  private attackTargets(quad: Quad): { mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[], mainObjectiveAchieved: boolean }  {
    const position = quad.pos
    const room = quad.room

    let mainTarget = null as QuadAttackTargetType | null
    const optionalTargets: QuadAttackTargetType[] = []

    for (const targetId of this.manualOperations.targetIds) {
      const target = Game.getObjectById(targetId)
      if (target == null || target.room == null || target.room.name !== room.name) {
        continue
      }
      if (mainTarget == null) {
        mainTarget = target
      } else {
        optionalTargets.push(target)
      }
    }

    const targetPriority = ((): StructureConstant[] => {
      return [ // 添字の大きい方が優先
        STRUCTURE_INVADER_CORE,
        STRUCTURE_LAB,
        STRUCTURE_POWER_SPAWN,
        STRUCTURE_EXTENSION,
        STRUCTURE_TERMINAL,
        STRUCTURE_SPAWN,
        STRUCTURE_TOWER,
        STRUCTURE_INVADER_CORE,
      ]
    })()
    const mainTargetStructures: StructureConstant[] = [
      STRUCTURE_TERMINAL,
      STRUCTURE_SPAWN,
      STRUCTURE_TOWER,
      STRUCTURE_INVADER_CORE,
    ]
    const excludedStructureTypes: StructureConstant[] = [
      STRUCTURE_STORAGE,  // 攻撃する場合は明示的に設定する
      STRUCTURE_CONTROLLER,
      // STRUCTURE_RAMPART,
      STRUCTURE_KEEPER_LAIR,
      STRUCTURE_POWER_BANK,
      STRUCTURE_EXTRACTOR,
    ]
    const targetStructures = room.find(FIND_HOSTILE_STRUCTURES)
      .filter(structure => excludedStructureTypes.includes(structure.structureType) !== true)
      .sort((lhs, rhs) => {
        const priority = targetPriority.indexOf(rhs.structureType) - targetPriority.indexOf(lhs.structureType)
        if (priority !== 0) {
          return priority
        }
        return lhs.pos.getRangeTo(position) - rhs.pos.getRangeTo(position)
      })
    const mainObjectiveAchieved = targetStructures.every(structure => mainTargetStructures.includes(structure.structureType) !== true)

    if (mainTarget == null) {
      mainTarget = targetStructures.shift() ?? null
    }
    optionalTargets.push(...targetStructures)

    const hostileAttackers: Creep[] = []
    const hostileWorkers: AnyCreep[] = position.findInRange(FIND_HOSTILE_POWER_CREEPS, 4)
    const whitelist = Memory.gameInfo.sourceHarvestWhitelist || []
    position.findInRange(FIND_HOSTILE_CREEPS, 4).forEach(creep => {
      if (whitelist.includes(creep.owner.username) === true) {
        return
      }

      // 現在はmainTargetによってmeleeに近づかない判定なども行っているため
      // const rampart = creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } })[0]
      // if (rampart == null || rampart.hits > 1000) {
      //   return
      // }
      if (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) {
        hostileAttackers.push(creep)
      } else {
        hostileWorkers.push(creep)
      }
    });

    ((): void => {
      if (mainTarget == null) {
        mainTarget = hostileAttackers.shift() ?? null
        return
      }
      const hostileAttacker = hostileAttackers.shift() ?? null
      if (hostileAttacker == null) {
        return
      }
      if (quad.getMinRangeTo(mainTarget.pos) > 3) {
        hostileAttackers.unshift(hostileAttacker)
        return
      }
      optionalTargets.unshift(mainTarget)
      mainTarget = hostileAttacker
      return
    })()

    optionalTargets.unshift(...hostileWorkers)
    optionalTargets.unshift(...hostileAttackers)

    if (mainTarget == null) {
      const hostileCreepsInRoom = room.find(FIND_HOSTILE_CREEPS).filter(creep => whitelist.includes(creep.owner.username) !== true)
      mainTarget = position.findClosestByPath(hostileCreepsInRoom)
    }

    if (mainTarget == null && optionalTargets.length <= 0) {
      const roads = quad.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_ROAD } })
        .filter(road => road.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length <= 0)
        .sort((lhs, rhs) => {
          return lhs.pos.getRangeTo(position) - rhs.pos.getRangeTo(position)
        })

      return {
        mainTarget: roads.shift() ?? null,
        optionalTargets: roads,
        mainObjectiveAchieved,
      }
    }

    return {
      mainTarget,
      optionalTargets,
      mainObjectiveAchieved,
    }
  }

  private hostileCreepsInRoom(room: Room): AnyCreep[] {
    const whitelist = Memory.gameInfo.sourceHarvestWhitelist || []
    const filter = (creep: AnyCreep): boolean => {
      if (whitelist.includes(creep.owner.username) === true) {
        return false
      }
      return true
    }
    return [
      ...room.find(FIND_HOSTILE_CREEPS).filter(filter),
      ...room.find(FIND_HOSTILE_POWER_CREEPS).filter(filter),
    ]
  }

  private damagedMyCreepsInRoom(quad: Quad): AnyCreep[] {
    const damagedCreeps = quad.room.find(FIND_MY_CREEPS).filter(creep => {
      if (quad.includes(creep.name) === true) {
        return false
      }
      if (creep.hits < creep.hitsMax) {
        return true
      }
      return false
    })
    const damagedPowerCreeps = quad.room.find(FIND_MY_POWER_CREEPS).filter(creep => {
      if (creep.hits < creep.hitsMax) {
        return true
      }
      return false
    })
    return [
      ...damagedCreeps,
      ...damagedPowerCreeps,
    ]
  }

  private isBoosted(creep: Creep): boolean {
    const boosts = this.quadSpec.boosts
    if (boosts.length <= 0) {
      return true
    }
    return boosts.every(boost => {
      const boostablePart = boostableCreepBody(boost)
      if (creep.getActiveBodyparts(boostablePart) <= 0) {
        return true
      }
      return creep.body.every(body => {
        if (body.type !== boostablePart) {
          return true
        }
        return body.boost === boost
      })
    })
  }

  private boostCreep(creep: Creep): void {
    const unboostedType = this.quadSpec.boosts.find(boost => {
      return creep.body.some(body => {
        if (body.boost != null) {
          return false
        }
        if (body.type === boostableCreepBody(boost)) {
          return true
        }
        return false
      })
    })
    if (unboostedType == null) {
      return
    }
    const labs = creep.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[]
    const boostLab = labs.find(lab => (lab.mineralType === unboostedType))
    if (boostLab == null) {
      PrimitiveLogger.programError(`${this.identifier} Lab with ${unboostedType} not found in ${roomLink(creep.room.name)}`)
      return
    }
    creep.v5task = MoveToTargetTask.create(BoostApiWrapper.create(boostLab))
  }

  private closestNeighbourRoom(position: RoomPosition): RoomName | null {
    const exit = position.findClosestByPath(FIND_EXIT)
    if (exit == null) {
      return null
    }

    const roomCoordinate = RoomCoordinate.parse(position.roomName)
    if (roomCoordinate == null) {
      PrimitiveLogger.programError(`${this.identifier} RoomCoordinate.parse() returns null ${roomLink(position.roomName)}`)
      return null
    }

    if (exit.x === GameConstants.room.edgePosition.min) {
      return roomCoordinate.neighbourRoom(LEFT)
    }
    if (exit.x === GameConstants.room.edgePosition.max) {
      return roomCoordinate.neighbourRoom(RIGHT)
    }
    if (exit.y === GameConstants.room.edgePosition.min) {
      return roomCoordinate.neighbourRoom(TOP)
    }
    if (exit.y === GameConstants.room.edgePosition.max) {
      return roomCoordinate.neighbourRoom(BOTTOM)
    }
    PrimitiveLogger.programError(`${this.identifier} position.findClosestByPath(FIND_EXIT) returns non-exit position ${exit} ${roomLink(position.roomName)}`)
    return null
  }

  private isLabReady(room: Room): boolean {
    const boosts = this.quadSpec.boosts
    if (boosts.length <= 0) {
      return true
    }
    const requiredBoosts = this.quadSpec.totalBoostAmounts()

    const labs = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[]
    for (const [boost, amount] of requiredBoosts.entries()) {
      if (amount <= 0) {
        continue
      }
      const boostLab = labs.find(lab => {
        if (lab.mineralType == null || lab.mineralType !== boost) {
          return false
        }
        if (lab.store.getUsedCapacity(boost) < amount) {
          return false
        }
        return true
      })
      if (boostLab == null) {
        return false
      }
    }
    return true
  }
}

function launchLabChargerProcess(parentRoomName: RoomName, quadSpec: QuadSpec): void {
  PrimitiveLogger.log(`Launch lab charger process for ${quadSpec.quadType}, boosts: ${quadSpec.boosts.map(boost => coloredResourceType(boost)).join(",")}`)

  const showRequiredBoosts = () => {
    const requiredBoosts = Array.from(quadSpec.totalBoostAmounts().entries()).map(([boost, amount]) => `${coloredResourceType(boost)}: ${coloredText(`${amount}`, "info")}`)
    PrimitiveLogger.log(`${coloredText("[Boost Needed]", "warn")}: ${requiredBoosts.join(", ")}`)
  }

  const boosts = quadSpec.boosts
  const existingProcessInfo = OperatingSystem.os.listAllProcesses()
    .find(processInfo => {
      const process = processInfo.process
      if (!(process instanceof Season1143119LabChargerProcess)) {
        return false
      }
      if (process.parentRoomName !== parentRoomName) {
        return false
      }
      return true
    })

  if (existingProcessInfo != null) {
    const process = existingProcessInfo.process
    if (!(process instanceof Season1143119LabChargerProcess)) {
      PrimitiveLogger.programError(`Season1673282SpecializedQuadProcess program error: ${process} is not Season1143119LabChargerProcess ${roomLink(parentRoomName)}`)
      return
    }
    if (JSON.stringify(process.boosts.sort()) === JSON.stringify(boosts)) {
      if (existingProcessInfo.running !== true) {
        OperatingSystem.os.resumeProcess(existingProcessInfo.processId)
      }
      PrimitiveLogger.log(`Season1673282SpecializedQuadProcess use Season1143119LabChargerProcess ${existingProcessInfo.processId} ${roomLink(parentRoomName)}`)
      showRequiredBoosts()
      return
    }
    OperatingSystem.os.killProcess(existingProcessInfo.processId)
  }

  const resources = RoomResources.getOwnedRoomResource(parentRoomName)
  if (resources == null) {
    PrimitiveLogger.fatal(`Room ${roomLink(parentRoomName)} is not owned`)
    return
  }
  const boostLabs = resources.roomInfo.config?.boostLabs
  if (boostLabs == null) {
    PrimitiveLogger.fatal(`Room ${roomLink(parentRoomName)} has no labs for boosting. Run Game.io("exec set_boost_labs")`)
    return
  }

  const labInfo: Season1143119LabChargerProcessLabInfo[] = []
  for (let i = 0; i < boosts.length; i += 1) {
    const boost = boosts[i]
    const labId = boostLabs[i]
    const lab = ((): StructureLab | null => {
      if (labId == null) {
        return null
      }
      const storedLab = Game.getObjectById(labId)
      if (storedLab instanceof StructureLab) {
        return storedLab
      }
      return null
    })()
    if (boost == null || lab == null) {
      PrimitiveLogger.fatal(`Room ${roomLink(parentRoomName)} has no enough labs for boosting (required: ${boosts.length}, labs: ${boostLabs.length}). Run Game.io("exec set_boost_labs")`)
      return
    }
    labInfo.push({
      lab,
      boost,
    })
  }

  showRequiredBoosts()

  OperatingSystem.os.addProcess(processId => {
    return Season1143119LabChargerProcess.create(processId, parentRoomName, labInfo)
  })
}
