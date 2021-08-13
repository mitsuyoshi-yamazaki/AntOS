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
import { CreepName } from "prototype/creep"
import { GameConstants } from "utility/constants"
import { boostableCreepBody } from "utility/resource"

type AttackTarget = AnyCreep | AnyStructure
type CreepBodySpec = {
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export const season1673282SpecializedQuadProcessCreepType = [
  "test-dismantler",
  "test-attacker",
  "invader-core-attacker",
  "tier0-d100-attacker",
  "tier0-d450",
  "tire0-d360-dismantler",
  "no-defence-3tower",
  "tier3-d2000-dismantler-swamp",
] as const
type Season1673282SpecializedQuadProcessCreepType = typeof season1673282SpecializedQuadProcessCreepType[number]

export const isSeason1673282SpecializedQuadProcessCreepType = (obj: string): obj is Season1673282SpecializedQuadProcessCreepType => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return season1673282SpecializedQuadProcessCreepType.includes(obj as any)
}

const noBoosts: MineralBoostConstant[] = [
]

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

const invaderCoreAttackerAttacker: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Mover],
  body: [
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ],
}
const invaderCoreAttackerHealer: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL,
  ],
}

const tier0h3HealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL,
  ]
}
const tier0AttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE,
  ]
}

const tire0h10HealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL,
    MOVE, HEAL,
  ]
}
const tire0DismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    WORK, WORK, WORK, WORK,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE,
    MOVE, MOVE, MOVE, MOVE,
  ]
}

// const noDefence3TowerAttackerSpec: CreepBodySpec = {
//   roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
//   body: [
//     TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
//     TOUGH,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     MOVE, MOVE, MOVE, MOVE, MOVE,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     RANGED_ATTACK, RANGED_ATTACK,
//     MOVE, MOVE, MOVE, MOVE, MOVE,
//     MOVE, MOVE, MOVE, MOVE, MOVE,
//     MOVE, MOVE,
//     HEAL, HEAL, HEAL, HEAL, HEAL,
//   ]
// }
const noDefence3TowerAttackerSpec: CreepBodySpec = {  // for RCL7
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
  ]
}


const noDefence3TowerAttackerBoost: MineralBoostConstant[] = [
  RESOURCE_ZYNTHIUM_OXIDE,
  RESOURCE_LEMERGIUM_ALKALIDE,
  RESOURCE_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
]

const tier3SwampHealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL,
  ]
}
const tier3SwampDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
  ]
}

// XZHO2,XLHO2,KHO2,XGHO2,XZH2O
const tier3DismantlerBoost1: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
  RESOURCE_CATALYZED_ZYNTHIUM_ACID,
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

// test tier0-d100-attacker
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W14S28 target_room_name=W14S26 waypoints=W14S27 creep_type=tier0-d100-attacker targets=")

// W11S23 tier0-d450
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W9S24 target_room_name=W11S23 waypoints=W10S24,W11S24 creep_type=tier0-d450 targets=")
// tire0-d360-dismantler
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W9S24 target_room_name=W11S23 waypoints=W10S24,W11S24 creep_type=tire0-d360-dismantler targets=610ea82a56c8192c44e7de28,60fc574ea19fa5e4ddb0b833")

// W11S25
// tier0-d450
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W9S24 target_room_name=W11S25 waypoints=W10S24,W10S25 creep_type=tier0-d450 targets=611362889c09be8c65e9e5c6")

// W13S27 tier0-d450
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W14S28 target_room_name=W13S27 waypoints=W14S30,W12S30,W12S28,W13S28 creep_type=tier0-d450 targets=")
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W14S28 target_room_name=W13S27 waypoints=W14S30,W12S30,W12S28,W13S28 creep_type=tire0-d360-dismantler targets=")
// W13S27 tier3-d2000-dismantler-swamp
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W14S28 target_room_name=W13S27 waypoints=W14S30,W12S30,W12S28,W13S28 creep_type=tier3-d2000-dismantler-swamp targets=")

// W2S29
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W3S24 target_room_name=W2S29 waypoints=W3S25,W2S25,W2S28 creep_type=tier0-d450 targets=")

// W27S29 tire0-d360-dismantler
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W24S29 target_room_name=W27S29 waypoints=W24S30,W27S30 creep_type=tire0-d360-dismantler targets=")

// E3S29 no-defence-3tower
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W6S29 target_room_name=E3S29 waypoints=W6S30,E4S30,E4S29 creep_type=no-defence-3tower targets=")

// E5S29 invader-core-attacker
// Game.io("launch -l Season1673282SpecializedQuadProcess room_name=W6S29 target_room_name=E5S29 waypoints=W6S30,E5S30 creep_type=invader-core-attacker targets=")
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
    case "test-attacker":
      this.boosts = [...noBoosts]
      break
    case "invader-core-attacker":
    case "tier0-d100-attacker":
    case "tier0-d450":
    case "tire0-d360-dismantler":
      this.boosts = [...noBoosts]
      break
    case "tier3-d2000-dismantler-swamp":
      this.boosts = [...tier3DismantlerBoost1]
      break
    case "no-defence-3tower":
      this.boosts = [...noDefence3TowerAttackerBoost]
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
    if (message === "clear") {
      this.predefinedTargetIds.splice(0, this.predefinedTargetIds.length)
      return "cleared"
    }
    const direction = parseInt(message, 10)
    if (this.quadState != null && isNaN(direction) !== true && ([TOP, BOTTOM, RIGHT, LEFT] as number[]).includes(direction) === true) {
      this.quadState.direction = direction as TOP | BOTTOM | RIGHT | LEFT
      return `direction ${direction} set`
    }
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
    const squadCreepCount = ((): number => {
      switch (this.creepType) {
      case "test-dismantler":
      case "test-attacker":
        return 4
      case "invader-core-attacker":
        return 3
      case "tier0-d100-attacker":
      case "tier0-d450":
      case "tire0-d360-dismantler":
      case "tier3-d2000-dismantler-swamp":
      case "no-defence-3tower":
        return 4
      }
    })()
    const creepInsufficiency = squadCreepCount - this.creepNames.length
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
        case "invader-core-attacker":
          if (creepInsufficiency >= 2) {
            return invaderCoreAttackerAttacker
          } else {
            return invaderCoreAttackerHealer
          }
        case "tier0-d100-attacker":
          if (creepInsufficiency <= 1) {
            return tier0AttackerSpec
          } else {
            return tier0h3HealerSpec
          }
        case "tier0-d450":
          return tire0h10HealerSpec
        case "tire0-d360-dismantler":
          if (creepInsufficiency <= 1) {
            return tire0DismantlerSpec
          } else {
            return tire0h10HealerSpec
          }
        case "tier3-d2000-dismantler-swamp":
          if (creepInsufficiency <= 1) {
            return tier3SwampDismantlerSpec
          } else {
            return tier3SwampHealerSpec
          }
        case "no-defence-3tower":
          return noDefence3TowerAttackerSpec
        }
      })()
      this.requestCreep(priority, creepInsufficiency, spec)
    }

    if (quad != null) {
      const isBoosting = quad.numberOfCreeps < creeps.length
      quad.beforeRun()
      if (isBoosting !== true || quad.room.name === this.parentRoomName) {
        this.runQuad(quad)
      } else {
        quad.heal()
      }
      quad.run()
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
    if (quad.inRoom(this.targetRoomName) !== true) {
      quad.moveToRoom(this.targetRoomName, this.waypoints)
      quad.passiveAttack(this.hostileCreepsInRoom(quad.room))
      quad.heal()
      return
    }

    if (quad.damagePercent * 4 > 0.15) {
      const closestNeighbourRoom = this.closestNeighbourRoom(quad.pos)
      if (closestNeighbourRoom != null) {
        quad.moveToRoom(closestNeighbourRoom, [], true)
        quad.passiveAttack(this.hostileCreepsInRoom(quad.room))
        quad.heal()
        return
      }
    }

    const { mainTarget, optionalTargets } = this.attackTargets(quad)
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
      if ((mainTarget instanceof Creep) && mainTarget.getActiveBodyparts(ATTACK) > 0) {
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

  private attackTargets(quad: Quad): { mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[] }  {
    const position = quad.pos
    const room = quad.room

    let mainTarget = null as QuadAttackTargetType | null
    const optionalTargets: QuadAttackTargetType[] = []

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
      // STRUCTURE_STORAGE,
      STRUCTURE_CONTROLLER,
      // STRUCTURE_RAMPART,
      STRUCTURE_KEEPER_LAIR,
      STRUCTURE_POWER_BANK,
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
      return {
        mainTarget: null,
        optionalTargets: quad.pos.findInRange(FIND_STRUCTURES, 4, { filter: {structureType: STRUCTURE_ROAD}})
      }
    }

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
    if (this.boosts.length <= 0) {
      return true
    }
    return this.boosts.every(boost => {
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
    const unboostedType = this.boosts.find(boost => {
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
}
