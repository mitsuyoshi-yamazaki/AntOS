import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "process/process_log"
import { MessageObserver } from "os/infrastructure/message_observer"
import { HRAQuad, QuadState } from "./season_1536602_quad"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { BoostApiWrapper } from "v5_object_task/creep_task/api_wrapper/boost_api_wrapper"

const testing = false as boolean

const testBody: BodyPartConstant[] = [
  RANGED_ATTACK, MOVE, MOVE, HEAL,
]

const creepRoles: CreepRole[] = [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover]
const tire0CreepBody: BodyPartConstant[] = [
  TOUGH, TOUGH,
  RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
  MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  HEAL, HEAL, HEAL, HEAL, HEAL,
]
const tire1CreepBody: BodyPartConstant[] = [
  TOUGH, MOVE,  // TODO:
]

type BoostTire = 0 | 1

const tire0Boosts: MineralBoostConstant[] = [
]
const tire1Boosts: MineralBoostConstant[] = [
  RESOURCE_LEMERGIUM_OXIDE,
  RESOURCE_KEANIUM_OXIDE,
  RESOURCE_ZYNTHIUM_OXIDE,
]

// const tire2Boosts: MineralBoostConstant[] = [
//   RESOURCE_LEMERGIUM_ALKALIDE,
//   RESOURCE_GHODIUM_ALKALIDE,
//   RESOURCE_KEANIUM_OXIDE,
//   RESOURCE_ZYNTHIUM_OXIDE,
// ]

export interface Season1536602QuadAttackerProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  targetRoomName: RoomName
  waypoints: RoomName[]
  predefinedTargetIds: Id<AnyStructure | AnyCreep>[]
  boostTire: BoostTire
  quadState: QuadState
}

// tire 0
// Game.io("launch -l Season1536602QuadAttackerProcess room_name=W3S24 target_room_name=W2S24 waypoints=W3S25,W2S25 tire=0 targets=610b186f76fc229c3e3a17dc,610896928f86f5747bf5a8d0")
export class Season1536602QuadAttackerProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  private readonly codename: string

  private readonly boosts: MineralBoostConstant[]

  private readonly creepRole: CreepRole[]
  private readonly creepBody: BodyPartConstant[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly predefinedTargetIds: Id<AnyStructure | AnyCreep>[],
    private readonly boostTire: BoostTire,
    private quadState: QuadState,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    if (testing === true) {
      this.boosts = [RESOURCE_KEANIUM_OXIDE]
      this.creepRole = creepRoles
      this.creepBody = testBody
    } else {
      this.creepRole = creepRoles
      switch (this.boostTire) {
      case 0:
        this.boosts = tire0Boosts
        this.creepBody = tire0CreepBody
        break
      case 1:
        this.boosts = tire1Boosts
        this.creepBody = tire1CreepBody
        break
      }
    }
  }

  public encode(): Season1536602QuadAttackerProcessState {
    return {
      t: "Season1536602QuadAttackerProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomName: this.targetRoomName,
      waypoints: this.waypoints,
      predefinedTargetIds: this.predefinedTargetIds,
      boostTire: this.boostTire,
      quadState: this.quadState,
    }
  }

  public static decode(state: Season1536602QuadAttackerProcessState): Season1536602QuadAttackerProcess {
    return new Season1536602QuadAttackerProcess(state.l, state.i, state.p, state.targetRoomName, state.waypoints, state.predefinedTargetIds, state.boostTire, state.quadState)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], predefinedTargetIds: Id<AnyStructure>[], boostTire: BoostTire): Season1536602QuadAttackerProcess {
    const quadState: QuadState = {
      creepNames: [],
    }
    return new Season1536602QuadAttackerProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, predefinedTargetIds, boostTire, quadState)
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    return `${roomLink(this.parentRoomName)} => ${this.targetRoomName} ${creepCount}cr`
  }

  public didReceiveMessage(message: string): string {
    if (message.length <= 0) {
      return "Empty message"
    }
    this.predefinedTargetIds.push(message as Id<AnyStructure | AnyCreep>)
    return "ok"
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    creeps.forEach(creep => {
      if (this.quadState.creepNames.includes(creep.name) !== true) {
        this.quadState.creepNames.push(creep.name)
      }
    })

    const creepCount = 4//testing ? 1 : 4
    const priority = ((): CreepSpawnRequestPriority => {
      if (testing === true) {
        return CreepSpawnRequestPriority.High
      }
      if (this.quadState.creepNames.length <= 0) {
        return CreepSpawnRequestPriority.Low
      }
      return CreepSpawnRequestPriority.High
    })()
    const creepInsufficiency = creepCount - this.quadState.creepNames.length
    if (creepInsufficiency > 0) {
      this.requestCreep(priority, creepInsufficiency)
    }

    if (this.quadState.creepNames.length > 0) {
      const quad = new HRAQuad(this.quadState.creepNames)
      if (quad.numberOfCreeps > 0) {
        this.runQuad(quad)
        const quadRoom = quad.topRightRoom
        const roomInfo = quadRoom != null ? ` in ${roomLink(quadRoom.name)}` : ""
        processLog(this, `${quad.numberOfCreeps}creeps${roomInfo}`)
        return
      }
      processLog(this, "Quad dead")
      return
    }
    processLog(this, "No creeps")
  }

  private requestCreep(priority: CreepSpawnRequestPriority, numberOfCreeps: number): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles: this.creepRole,
      body: this.creepBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runQuad(quad: HRAQuad): void {
    quad.heal()
    if (quad.inRoom(this.targetRoomName) !== true) {
      this.moveQuadToRoom(quad)
      return
    }
    this.attackQuad(quad)
  }

  private attackQuad(quad: HRAQuad): void {
    const nearbyHostileCreep = this.nearbyHostileAttacker(quad)
    if (nearbyHostileCreep != null) {
      quad.attack(nearbyHostileCreep)
      return
    }

    const target = this.attackTarget(quad)
    if (target != null) {
      quad.moveQuadTo(target.pos, 3)
      quad.attack(target)
      return
    }

    quad.say("nth to do")
  }

  private attackTarget(quad: HRAQuad): AnyStructure | AnyCreep | null {
    const room = quad.topRightRoom
    if (room == null) {
      return null
    }
    for (const targetId of this.predefinedTargetIds) {
      const target = Game.getObjectById(targetId)
      if (target != null) {
        return target
      }
    }
    const targetPriority: StructureConstant[] = [ // 添字の大きい方が優先
      STRUCTURE_TERMINAL,
      STRUCTURE_SPAWN,
      STRUCTURE_TOWER,
    ]
    const targetStructure = room.find(FIND_HOSTILE_STRUCTURES).sort((lhs, rhs) => {
      return targetPriority.indexOf(rhs.structureType) - targetPriority.indexOf(lhs.structureType)
    })[0]
    return targetStructure ?? null
  }

  private nearbyHostileAttacker(quad: HRAQuad): Creep | null {
    const position = quad.topRightPosition
    if (position == null) {
      return null
    }
    const whitelist = Memory.gameInfo.sourceHarvestWhitelist || []
    const closestAttacker = position.findInRange(FIND_HOSTILE_CREEPS, 4)
      .filter(creep => {
        if (whitelist.includes(creep.owner.username) === true) {
          return
        }
        return creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0
      })
      .sort((lhs, rhs) => {
        return (lhs.pos.getRangeTo(position)) - (rhs.pos.getRangeTo(position))
      })[0] ?? null
    return  closestAttacker
  }

  private moveQuadToRoom(quad: HRAQuad): void {
    quad.moveQuadToRoom(this.targetRoomName, this.waypoints)

    quad.creeps.forEach(creep => {
      if (creep.room.name !== this.parentRoomName) {
        return
      }
      if (creep.v5task != null) {
        return
      }
      if (this.isBoosted(creep) === true) {
        return
      }
      this.boostCreep(creep)
    })
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
}
