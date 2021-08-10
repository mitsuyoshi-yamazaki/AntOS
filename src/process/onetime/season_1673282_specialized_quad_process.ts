import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomCoordinate, RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "process/process_log"
import { MessageObserver } from "os/infrastructure/message_observer"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { BoostApiWrapper } from "v5_object_task/creep_task/api_wrapper/boost_api_wrapper"
import { OperatingSystem } from "os/os"
import { Quad, QuadAttackTargetType, QuadState } from "./season_1673282_specialized_quad"
import { CreepName, isAnyCreep } from "prototype/creep"
import { GameConstants } from "utility/constants"

type AttackTarget = AnyCreep | AnyStructure
type CreepBodySpec = {
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export const season1673282SpecializedQuadProcessCreepType = [
  "test-dismantler",
  "test-attacker",
] as const
type Season1673282SpecializedQuadProcessCreepType = typeof season1673282SpecializedQuadProcessCreepType[number]

export const isSeason1673282SpecializedQuadProcessCreepType = (obj: string): obj is Season1673282SpecializedQuadProcessCreepType => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return season1673282SpecializedQuadProcessCreepType.includes(obj as any)
}

const testHealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [RANGED_ATTACK, MOVE, MOVE, HEAL],
}
const testDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Healer, CreepRole.Mover],
  body: [WORK, MOVE, MOVE, HEAL],
}
const testAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Healer, CreepRole.Mover],
  body: [ATTACK, MOVE, MOVE, HEAL],
}

const noBoosts: MineralBoostConstant[] = [
]

export interface Season1673282SpecializedQuadProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  targetRoomName: RoomName
  waypoints: RoomName[]
  predefinedTargetIds: Id<AttackTarget>[]
  creepType: Season1673282SpecializedQuadProcessCreepType
  creepNames: CreepName[]
  quadState: QuadState | null
}

// test
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W9S24 target_room_name=W10S29 waypoints=W10S24 creep_type=test-attacker targets=")
export class Season1673282SpecializedQuadProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  private readonly codename: string

  private readonly boosts: MineralBoostConstant[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly predefinedTargetIds: Id<AttackTarget>[],
    private readonly creepType: Season1673282SpecializedQuadProcessCreepType,
    private readonly creepNames: CreepName[],
    private quadState: QuadState | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    switch (this.creepType) {
    case "test-dismantler":
      this.boosts = noBoosts
      break
    case "test-attacker":
      this.boosts = noBoosts
      break
    }
  }

  public encode(): Season1673282SpecializedQuadProcessState {
    return {
      t: "Season1673282SpecializedQuadProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomName: this.targetRoomName,
      waypoints: this.waypoints,
      predefinedTargetIds: this.predefinedTargetIds,
      creepType: this.creepType,
      creepNames: this.creepNames,
      quadState: this.quadState,
    }
  }

  public static decode(state: Season1673282SpecializedQuadProcessState): Season1673282SpecializedQuadProcess {
    return new Season1673282SpecializedQuadProcess(state.l, state.i, state.p, state.targetRoomName, state.waypoints, state.predefinedTargetIds, state.creepType, state.creepNames, state.quadState)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], predefinedTargetIds: Id<AttackTarget>[], creepType: Season1673282SpecializedQuadProcessCreepType): Season1673282SpecializedQuadProcess {
    return new Season1673282SpecializedQuadProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, predefinedTargetIds, creepType, [], null)
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    return `${roomLink(this.parentRoomName)} => ${roomLink(this.targetRoomName)} ${creepCount}cr`
  }

  public didReceiveMessage(message: string): string {
    if (message.length <= 0) {
      return "Empty message"
    }
    this.predefinedTargetIds.unshift(message as Id<AnyStructure | AnyCreep>)
    return "ok"
  }

  public runOnTick(): void {
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
      if (this.creepType === "test-dismantler") {
        return CreepSpawnRequestPriority.High
      }
      if (quad == null) {
        return CreepSpawnRequestPriority.Low
      }
      return CreepSpawnRequestPriority.High
    })()
    const creepInsufficiency = ((): number => {
      switch (this.creepType) {
      case "test-dismantler":
      case "test-attacker":
        return 4 - this.creepNames.length
      }
    })()
    if (creepInsufficiency > 0) {
      const spec = ((): CreepBodySpec => {
        switch (this.creepType) {
        case "test-dismantler":
          if (creepInsufficiency <= 1) {
            return testDismantlerSpec
          } else {
            return testHealerSpec
          }
        case "test-attacker":
          if (creepInsufficiency <= 1) {
            return testAttackerSpec
          } else {
            return testHealerSpec
          }
        }
      })()
      this.requestCreep(priority, creepInsufficiency, spec)
    }

    if (quad != null) {
      this.runQuad(quad)
      quad.run()
      this.quadState = quad.encode()
      const roomInfo = ` in ${roomLink(quad.pos.roomName)}`
      processLog(this, `${quad.numberOfCreeps}creeps${roomInfo}`)
      return
    }
    this.quadState = null

    if (this.creepNames.length > 0) {
      processLog(this, "Quad dead")
      OperatingSystem.os.killProcess(this.processId)
      return
    }
    processLog(this, "No creeps")
  }

  private requestCreep(priority: CreepSpawnRequestPriority, numberOfCreeps: number, spec: CreepBodySpec): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles: spec.roles,
      body: spec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runQuad(quad: Quad): void {
    quad.heal()
    if (quad.inRoom(this.targetRoomName) !== true) {
      quad.moveToRoom(this.targetRoomName, this.waypoints)
      quad.passiveAttack(this.hostileCreepsInRoom(quad.room))
      return
    }

    if (quad.damagePercent * 4 > 0.25) {
      const closestNeighbourRoom = this.closestNeighbourRoom(quad.pos)
      if (closestNeighbourRoom != null) {
        quad.moveToRoom(closestNeighbourRoom, [], true)
        quad.passiveAttack(this.hostileCreepsInRoom(quad.room))
        return
      }
    }

    const { mainTarget, optionalTargets } = this.attackTargets(quad.pos, quad.room)
    if (mainTarget != null && !isAnyCreep(mainTarget)) {
      quad.moveTo(mainTarget.pos, 1)
    } else {
      quad.keepQuadForm()
    }
    quad.attack(mainTarget, optionalTargets)
  }

  private attackTargets(position: RoomPosition, room: Room): { mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[]}  {
    let mainTarget = null as QuadAttackTargetType | null
    const optionalTargets: QuadAttackTargetType[] = []

    const hostileAttackers: Creep[] = []
    const hostileWorkers: AnyCreep[] = position.findInRange(FIND_HOSTILE_POWER_CREEPS, 4)
    const whitelist = Memory.gameInfo.sourceHarvestWhitelist || []
    position.findInRange(FIND_HOSTILE_CREEPS, 4).forEach(creep => {
      if (whitelist.includes(creep.owner.username) === true) {
        return
      }
      if (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0) {
        hostileAttackers.push(creep)
      } else {
        hostileWorkers.push(creep)
      }
    })

    mainTarget = hostileAttackers.shift() ?? null
    optionalTargets.push(...hostileAttackers)
    optionalTargets.push(...hostileWorkers)

    for (const targetId of this.predefinedTargetIds) {
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

    const targetPriority: StructureConstant[] = [ // 添字の大きい方が優先
      STRUCTURE_STORAGE,
      STRUCTURE_POWER_SPAWN,
      STRUCTURE_TERMINAL,
      STRUCTURE_EXTENSION,
      STRUCTURE_SPAWN,
      STRUCTURE_TOWER,
    ]
    const excludedStructureTypes: StructureConstant[] = [
      STRUCTURE_CONTROLLER,
      STRUCTURE_RAMPART,
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
    if (mainTarget == null) {
      mainTarget = targetStructures.shift() ?? null
    }

    optionalTargets.push(...targetStructures)

    return {
      mainTarget,
      optionalTargets,
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

  private isBoosted(creep: Creep): boolean {
    if (this.boosts.length <= 0) {
      return true
    }
    return this.boosts.every(boost => {
      return creep.body.some(body => body.boost === boost)
    })
  }

  private boostCreep(creep: Creep): void {
    const unboostedType = this.boosts.find(boost => {
      return creep.body.every(body => body.boost !== boost)
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
}

