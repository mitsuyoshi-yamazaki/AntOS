import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName, roomTypeOf } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepName, defaultMoveToOptions } from "prototype/creep"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { SourceKeeper } from "game/source_keeper"
import { GameConstants, OBSTACLE_COST } from "utility/constants"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

interface Season845677Attack1TowerProcessSquad {
  leaderCreepName: CreepName
  followerCreepName: CreepName
}

export interface Season845677Attack1TowerProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** waiting position */
  wp: RoomPositionState

  /** target structure id */
  ti: Id<AnyStructure> | null

  /** creeps */
  c: {
    /** waiting creep names */
    w: CreepName[]

    /** squads */
    s: Season845677Attack1TowerProcessSquad[]
  }

  /** number of creeps */
  n: number
}

// Game.io("launch -l Season845677Attack1TowerProcess room_name=W14S28 target_room_name=W11S23 waypoints=W14S30,W10S30")
export class Season845677Attack1TowerProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly attackerRoles: CreepRole[] = [CreepRole.Attacker, CreepRole.Healer, CreepRole.Mover]
  // private readonly attackerBody: BodyPartConstant[] = [
  //   MOVE,
  // ]
  private readonly attackerBody: BodyPartConstant[] = [
    TOUGH, TOUGH, TOUGH,
    MOVE, MOVE, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly waitingPosition: RoomPosition,
    private target: AnyStructure | null,
    private waitingCreepNames: CreepName[],
    private readonly squads: Season845677Attack1TowerProcessSquad[],
    private numberOfCreeps: number,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season845677Attack1TowerProcessState {
    return {
      t: "Season845677Attack1TowerProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      wp: this.waitingPosition.encode(),
      ti: this.target?.id ?? null,
      c: {
        w: this.waitingCreepNames,
        s: this.squads,
      },
      n: this.numberOfCreeps,
    }
  }

  public static decode(state: Season845677Attack1TowerProcessState): Season845677Attack1TowerProcess {
    const target = ((): AnyStructure | null => {
      if (state.ti == null) {
        return null
      }
      return Game.getObjectById(state.ti)
    })()
    const waitingPosition = decodeRoomPosition(state.wp)
    return new Season845677Attack1TowerProcess(state.l, state.i, state.p, state.tr, state.w, waitingPosition, target, state.c.w, state.c.s, state.n)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], waitingPosition: RoomPosition): Season845677Attack1TowerProcess {
    return new Season845677Attack1TowerProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, waitingPosition, null, [], [], 2)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const insufficientCreepCount = this.numberOfCreeps

    if (insufficientCreepCount > 0) {
      const priority: CreepSpawnRequestPriority = insufficientCreepCount > 1 ? CreepSpawnRequestPriority.Low : CreepSpawnRequestPriority.High
      this.requestAttacker(priority, insufficientCreepCount)
    }

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    this.runCreeps(creeps)
  }

  private requestAttacker(priority: CreepSpawnRequestPriority, numberOfCreeps: number): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles: this.attackerRoles,
      body: this.attackerBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runCreeps(creeps: Creep[]): void {
    this.updateSquads(creeps)
    this.runWaitingCreeps()
    this.runSquads()
  }

  private runWaitingCreeps(): void {
    const deadCreepNames: CreepName[] = []
    this.waitingCreepNames.forEach(creepName => {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        deadCreepNames.push(creepName)
        return
      }

      creep.moveTo(this.waitingPosition)
    })

    this.waitingCreepNames = this.waitingCreepNames.filter(creepName => deadCreepNames.includes(creepName) !== true)
  }

  private runSquads(): void {
    const deadSquadIndexes: number[] = []
    this.squads.forEach((squad, index) => {
      const leaderCreep = Game.creeps[squad.leaderCreepName]
      const followerCreep = Game.creeps[squad.followerCreepName]
      if (leaderCreep != null && followerCreep != null) {
        this.runSquad(leaderCreep, followerCreep)
      } else if (leaderCreep == null && followerCreep == null) {
        deadSquadIndexes.push(index)
      } else {
        const creep = leaderCreep ?? followerCreep
        this.runCollapsedSquad(creep)
      }
    })
  }

  private runSquad(leaderCreep: Creep, followerCreep: Creep): void {
    if (leaderCreep.room.name !== followerCreep.room.name) {
      this.moveIntoRoom(leaderCreep)
      followerCreep.moveTo(leaderCreep.pos)
      this.attackNearbyCreeps(leaderCreep, followerCreep)
      leaderCreep.rangedAttack
      leaderCreep.heal(leaderCreep)
      followerCreep.heal(followerCreep)
      return
    }

    if (leaderCreep.room.name === this.targetRoomName) {
      this.attackSquad(leaderCreep, followerCreep)
      return
    }

    if (this.healSquad(leaderCreep, followerCreep) !== true) {
      if (this.leaderCanMove(leaderCreep, followerCreep) === true) {
        this.moveToRoom(leaderCreep)
      }
    }
    followerCreep.moveTo(leaderCreep.pos)
    this.attackNearbyCreeps(leaderCreep, followerCreep)
  }

  private attackSquad(leaderCreep: Creep, followerCreep: Creep): void {
    const attacked = this.attackNearbyCreeps(leaderCreep, followerCreep)

    const room = leaderCreep.room
    const structures = room.find(FIND_HOSTILE_STRUCTURES)
    const tower = structures.find(structure => structure.structureType === STRUCTURE_TOWER) as StructureTower | null
    if (tower != null) {
      if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        this.drainTower(tower, leaderCreep, followerCreep)
        return
      }
      if (attacked !== true) {
        this.attack(tower, leaderCreep, followerCreep)
      }
      return
    }

    if (attacked !== true) {
      const spawn = structures.find(structure => structure.structureType === STRUCTURE_SPAWN) as StructureSpawn | null
      if (spawn != null) {
        this.attack(spawn, leaderCreep, followerCreep)
        return
      }
    }

    // TODO:
  }

  private drainTower(tower: StructureTower, leaderCreep: Creep, followerCreep: Creep): void {
    if (this.attackNearbyCreeps(leaderCreep, followerCreep) !== true) {
      leaderCreep.rangedAttack(tower)
      followerCreep.rangedAttack(tower)
    }
    this.healSquad(leaderCreep, followerCreep)

    if (this.leaderCanMove(leaderCreep, followerCreep) === true) {
      const exitPosition = leaderCreep.pos.findClosestByPath(FIND_EXIT)
      if (exitPosition == null) {
        leaderCreep.say("no exit")  // TODO:
        return
      }

      if (leaderCreep.pos.isNearTo(exitPosition) !== true) {
        leaderCreep.moveTo(exitPosition)
      } else {
        const shouldExit = leaderCreep.hits < (leaderCreep.hitsMax * 0.8) || followerCreep.hits < (followerCreep.hitsMax * 0.8)
        if (shouldExit) {
          leaderCreep.moveTo(exitPosition)
        }
      }
    }
    followerCreep.moveTo(leaderCreep.pos)
  }

  private attack(target: AnyStructure, leaderCreep: Creep, followerCreep: Creep): void {
    if (this.attackNearbyCreeps(leaderCreep, followerCreep) !== true) {
      if (leaderCreep.pos.getRangeTo(target) <= 3) {
        leaderCreep.rangedAttack(target)
        followerCreep.rangedAttack(target)
      } else {
        leaderCreep.rangedMassAttack()
        followerCreep.rangedMassAttack()
      }
    }

    this.healSquad(leaderCreep, followerCreep)
    if (this.leaderCanMove(leaderCreep, followerCreep) === true) {
      leaderCreep.moveTo(target)
    }
    followerCreep.moveTo(leaderCreep)
  }

  private attackNearbyCreeps(leaderCreep: Creep, followerCreep: Creep): boolean {
    const attackBodyParts: BodyPartConstant[] = [ATTACK, RANGED_ATTACK]
    const enemyCreep1 = leaderCreep.pos.findInRange(FIND_HOSTILE_CREEPS, 3).filter(creep => creep.body.map(b => b.type).some(body => attackBodyParts.includes(body)))[0]
    const enemyCreep2 = followerCreep.pos.findInRange(FIND_HOSTILE_CREEPS, 3).filter(creep => creep.body.map(b => b.type).some(body => attackBodyParts.includes(body)))[0]

    const attacked = enemyCreep1 != null || enemyCreep2 != null

    if (enemyCreep1 != null) {
      leaderCreep.rangedAttack(enemyCreep1)
    } else if (attacked === true) {
      leaderCreep.rangedMassAttack()
    }
    if (enemyCreep2 != null) {
      followerCreep.rangedAttack(enemyCreep2)
    } else if (attacked === true) {
      followerCreep.rangedMassAttack()
    }
    return attacked
  }

  private healSquad(leaderCreep: Creep, followerCreep: Creep): boolean {
    const healableHits = HEAL_POWER * 7
    const leaderDamage = leaderCreep.hitsMax - leaderCreep.hits
    const followerDamage = followerCreep.hitsMax - followerCreep.hits

    if (leaderDamage <= 0 && followerDamage <= 0) {
      leaderCreep.heal(leaderCreep)
      followerCreep.heal(followerCreep)
      return false
    }
    if (leaderDamage <= 0) {
      leaderCreep.heal(followerCreep)
      followerCreep.heal(followerCreep)
      return true
    }
    if (followerDamage <= 0) {
      leaderCreep.heal(leaderCreep)
      followerCreep.heal(leaderCreep)
      return true
    }
    if (leaderDamage <= healableHits && followerDamage <= healableHits) {
      leaderCreep.heal(leaderCreep)
      followerCreep.heal(followerCreep)
      return true
    }
    const healTarget = leaderDamage > followerDamage ? leaderCreep : followerCreep
    leaderCreep.heal(healTarget)
    followerCreep.heal(healTarget)
    return true
  }

  private leaderCanMove(leaderCreep: Creep, followerCreep: Creep): boolean {
    if (leaderCreep.pos.isNearTo(followerCreep.pos) !== true) {
      return false
    }
    return followerCreep.fatigue <= 0
  }

  private runCollapsedSquad(creep: Creep): void {
    creep.say("alone")
  }

  private moveIntoRoom(creep: Creep): void {
    const directionIndex = (Game.time + this.launchTime) % 3

    if (creep.pos.x === 0) {
      creep.move([RIGHT, TOP_RIGHT, BOTTOM_RIGHT][directionIndex])
    } else if (creep.pos.x === 49) {
      creep.move([LEFT, TOP_LEFT, BOTTOM_LEFT][directionIndex])
    } else if (creep.pos.y === 0) {
      creep.move([BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT][directionIndex])
    } else if (creep.pos.y === 49) {
      creep.move([TOP, TOP_LEFT, TOP_RIGHT][directionIndex])
    }
  }

  private updateSquads(creeps: Creep[]): void {
    const squadCreepNames = this.squads.flatMap(squad => [squad.leaderCreepName, squad.followerCreepName])
    const unassignedCreeps = [...creeps].filter(creep => {
      if (this.waitingCreepNames.includes(creep.name) === true) {
        return false
      }
      if (squadCreepNames.includes(creep.name) === true) {
        return false
      }
      return true
    })

    this.numberOfCreeps -= unassignedCreeps.length

    const unassignedCreep = unassignedCreeps[0]
    if (unassignedCreep == null) {
      return
    }

    const waitingCreepName = this.waitingCreepNames.shift()
    if (waitingCreepName != null) {
      this.squads.push({
        leaderCreepName: waitingCreepName,
        followerCreepName: unassignedCreep.name,
      })
    } else {
      this.waitingCreepNames.push(unassignedCreep.name)
    }
  }

  private moveToRoom(creep: Creep): void {
    const directionIndex = (Game.time + this.launchTime) % 3

    if (creep.pos.x === 0) {
      if (creep.move([RIGHT, TOP_RIGHT, BOTTOM_RIGHT][directionIndex]) === OK) {
        return
      }
    } else if (creep.pos.x === 49) {
      if (creep.move([LEFT, TOP_LEFT, BOTTOM_LEFT][directionIndex]) === OK) {
        return
      }
    } else if (creep.pos.y === 0) {
      if (creep.move([BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT][directionIndex]) === OK) {
        return
      }
    } else if (creep.pos.y === 49) {
      if (creep.move([TOP, TOP_LEFT, TOP_RIGHT][directionIndex]) === OK) {
        return
      }
    }

    if (creep.room.name === this.targetRoomName) {
      return
    }

    const destinationRoomName = ((): RoomName => {
      const nextWaypoint = this.waypoints[0]
      if (nextWaypoint == null) {
        return this.targetRoomName
      }
      if (nextWaypoint === creep.room.name) {
        this.waypoints.shift()
        return this.waypoints[0] ?? this.targetRoomName
      }
      return nextWaypoint
    })()

    const reusePath = 20
    const noPathFindingOptions: MoveToOpts = {
      noPathFinding: true,
      reusePath,
    }

    const moveToOptions = ((): MoveToOpts => {
      const options: MoveToOpts = { ...defaultMoveToOptions }
      options.reusePath = reusePath
      if (roomTypeOf(creep.room.name) !== "source_keeper") {
        return options
      }
      creep.say("SK room")
      // 保存されたパスがあれば計算はスキップする

      const roomPositionFilteringOptions: RoomPositionFilteringOptions = {
        excludeItself: false,
        excludeTerrainWalls: false,
        excludeStructures: false,
        excludeWalkableStructures: false,
      }

      options.maxOps = 2000
      const sourceKeepers = creep.room.find(FIND_HOSTILE_CREEPS)
        .filter(creep => creep.owner.username === SourceKeeper.username)
      const positionsToAvoid = sourceKeepers
        .flatMap(creep => creep.pos.positionsInRange(4, roomPositionFilteringOptions))

      options.costCallback = (roomName: RoomName, costMatrix: CostMatrix): CostMatrix | void => {
        if (roomName !== creep.room.name) {
          return
        }
        positionsToAvoid.forEach(position => {
          // creep.room.visual.text("x", position.x, position.y, { align: "center", color: "#ff0000" })
          costMatrix.set(position.x, position.y, OBSTACLE_COST)
        })
        return costMatrix
      }
      return options
    })

    const exit = creep.room.findExitTo(destinationRoomName)
    if (exit === ERR_NO_PATH) {
      creep.say("no exit")
      return
    } else if (exit === ERR_INVALID_ARGS) {
      creep.say("invalid")
      PrimitiveLogger.fatal(`Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creep.room.name)} to ${roomLink(destinationRoomName)}`)
      return
    }

    const exitFlag = creep.room.find(FIND_FLAGS).find(flag => {
      switch (exit) {
      case FIND_EXIT_TOP:
        if (flag.pos.y === GameConstants.room.edgePosition.min) {
          return true
        }
        break
      case FIND_EXIT_BOTTOM:
        if (flag.pos.y === GameConstants.room.edgePosition.max) {
          return true
        }
        break
      case FIND_EXIT_LEFT:
        if (flag.pos.x === GameConstants.room.edgePosition.min) {
          return true
        }
        break
      case FIND_EXIT_RIGHT:
        if (flag.pos.x === GameConstants.room.edgePosition.max) {
          return true
        }
        break
      default:
        break
      }
      return false
    })

    const exitPosition = exitFlag?.pos ?? creep.pos.findClosestByPath(exit)
    if (exitPosition == null) {
      creep.say("no path")
      if (creep.room.controller != null) {
        creep.moveTo(creep.room.controller, defaultMoveToOptions)
      } else {
        creep.moveTo(25, 25, defaultMoveToOptions)
      }
      return
    }

    if (creep.moveTo(exitPosition, noPathFindingOptions) === ERR_NOT_FOUND) {
      creep.moveTo(exitPosition, moveToOptions())
    }
  }
}

