import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepName } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "process/process_log"
import { moveToRoom } from "script/move_to_room"

const testing = true
const debugLog = true as boolean

const targetWallPosition = new RoomPosition(12, 4, "W11S23")
const dismantlePosition = new RoomPosition(11, 3, "W11S23")
const nextRoomName = "W11S22"
const alignPosition = new RoomPosition(11, 47, nextRoomName)

type SquadStatus = "spawning" | "moving to target" | "align" | "dismantle" | "escape"

interface Season1022818Dismantle2TowerWallProcessSquadState {
  leader: CreepName
  topRight: CreepName
  topLeft: CreepName
  bottomLeft: CreepName
}

interface Season1022818Dismantle2TowerWallProcessSquad {
  leader: Creep
  topRight: Creep
  topLeft: Creep
  bottomLeft: Creep
}

export interface Season1022818Dismantle2TowerWallProcessState extends ProcessState {
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

  squadStatus: SquadStatus
  squad: Season1022818Dismantle2TowerWallProcessSquadState | null
  downgraderWaypoints: RoomName[]
}

// Game.io("launch -l Season1022818Dismantle2TowerWallProcess room_name=W14S28 target_room_name=W12S29 waypoints=W14S30,W12S30")

// for RCL7
export class Season1022818Dismantle2TowerWallProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly testBody: BodyPartConstant[] = [TOUGH, MOVE]

  private readonly dismantlerRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]
  private readonly dismantlerBody: BodyPartConstant[] = [
    TOUGH, TOUGH, TOUGH, TOUGH,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE,
    MOVE, MOVE, MOVE, MOVE,
  ]

  private readonly downgraderRoles: CreepRole[] = [CreepRole.Claimer, CreepRole.Mover]
  private readonly downgraderBody: BodyPartConstant[] = [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    MOVE, MOVE,
    CLAIM, MOVE, CLAIM, MOVE, CLAIM, MOVE, CLAIM, MOVE,
    MOVE, MOVE, MOVE, MOVE,
  ]

  private readonly healerRoles: CreepRole[] = [CreepRole.Healer, CreepRole.Mover]
  private readonly healerBody: BodyPartConstant[] = [
    TOUGH, TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL,
  ]
  private readonly healableHits: number

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly waitingPosition: RoomPosition,
    private target: AnyStructure | null,
    private squadStatus: SquadStatus,
    private squadState: Season1022818Dismantle2TowerWallProcessSquadState | null,
    private readonly downgraderWaypoints: RoomName[],
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
    this.healableHits = HEAL_POWER * this.healerBody.filter(body => HEAL).length
  }

  public encode(): Season1022818Dismantle2TowerWallProcessState {
    return {
      t: "Season1022818Dismantle2TowerWallProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      wp: this.waitingPosition.encode(),
      ti: this.target?.id ?? null,
      squadStatus: this.squadStatus,
      squad: this.squadState,
      downgraderWaypoints: this.downgraderWaypoints,
    }
  }

  public static decode(state: Season1022818Dismantle2TowerWallProcessState): Season1022818Dismantle2TowerWallProcess {
    const target = ((): AnyStructure | null => {
      if (state.ti == null) {
        return null
      }
      return Game.getObjectById(state.ti)
    })()
    const waitingPosition = decodeRoomPosition(state.wp)
    return new Season1022818Dismantle2TowerWallProcess(state.l, state.i, state.p, state.tr, state.w, waitingPosition, target, state.squadStatus, state.squad, state.downgraderWaypoints)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], waitingPosition: RoomPosition): Season1022818Dismantle2TowerWallProcess {
    return new Season1022818Dismantle2TowerWallProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, waitingPosition, null, "spawning", null, [...waypoints])
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    let dismantler: Creep | null = null
    // let downgrader: Creep | null = null
    const healers: Creep[] = []
    for (const creep of creeps) {
      if (hasNecessaryRoles(creep, this.dismantlerRoles) === true) {
        dismantler = creep
        continue
      }
      // if (hasNecessaryRoles(creep, this.downgraderRoles) === true) {
      //   downgrader = creep
      //   continue
      // }
      if (hasNecessaryRoles(creep, this.healerRoles) === true) {
        healers.push(creep)
        continue
      }
      PrimitiveLogger.programError(`${this.constructor.name} wrong code`)
    }

    let squad = ((): Season1022818Dismantle2TowerWallProcessSquad | null => {
      if (this.squadState == null) {
        return null
      }
      const leader = Game.creeps[this.squadState.leader]
      const topRight = Game.creeps[this.squadState.topRight]
      const topLeft = Game.creeps[this.squadState.topLeft]
      const bottomLeft = Game.creeps[this.squadState.bottomLeft]
      if (leader == null || topRight == null || topLeft == null || bottomLeft == null) {
        processLog(this, `Squad creep dead. leader: ${leader}, topRight: ${topRight}, topLeft: ${topLeft}, bottomLeft: ${bottomLeft}`)
        return null
      }
      return {
        leader,
        topRight,
        topLeft,
        bottomLeft,
      }
    })()

    if (squad == null && this.squadStatus === "spawning") {
      if (dismantler == null) {
        this.requestCreep(this.dismantlerRoles, this.dismantlerBody)
        processLog(this, `${coloredText("[Spawn]", "info")} dismantler`)
      } else if (healers.length < 3) {
        this.requestCreep(this.healerRoles, this.healerBody)
        processLog(this, `${coloredText("[Spawn]", "info")} healer(${healers.length + 1}/3)`)
      }
    }
    // else {
    //   if (this.rampartDestroyed === true && downgrader == null) {
    //     this.requestCreep(this.downgraderRoles, this.downgraderBody)
    //     processLog(this, `${coloredText("[Spawn]", "info")} downgrader`)
    //   }
    // }

    this.debugLog(`status: ${this.squadStatus}, dismantler: ${dismantler}, haulers: ${healers.length}`)

    if (squad == null) {
      squad = this.constructDismantlerSquad(dismantler, healers)
    }
    if (squad != null) {
      const canAttack = this.attackNearbyHostile(squad)
      this.runSquad(squad, canAttack)
      this.healSquad(squad)
    } else {
      this.debugLog("no squad")
      this.runWaitingCreeps(creeps)
    }
  }

  private requestCreep(roles: CreepRole[], body: BodyPartConstant[]): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Urgent,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: roles,
      body: testing ? this.testBody : body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private constructDismantlerSquad(dismantler: Creep | null, healers: Creep[]): Season1022818Dismantle2TowerWallProcessSquad | null {
    const topRight = healers[0]
    const topLeft = healers[1]
    const bottomLeft = healers[2]
    if (dismantler == null || topRight == null || topLeft == null || bottomLeft == null) {
      return null
    }
    if (this.squadStatus === "spawning") {
      this.squadStatus = "moving to target"
    }
    return {
      leader: dismantler,
      topRight,
      topLeft,
      bottomLeft,
    }
  }

  private runWaitingCreeps(creeps: Creep[]): void {
    creeps.forEach(creep => {
      creep.moveTo(this.waitingPosition)
      if (creep.room.name !== this.parentRoomName) {
        creep.heal(creep)
      }
    })
  }

  private runSquad(squad: Season1022818Dismantle2TowerWallProcessSquad, canAttack: boolean): void {
    if (hasNecessaryRoles(squad.leader, this.dismantlerRoles) === true) {
      this.runDismantleSquad(squad, canAttack)
      return
    }
    PrimitiveLogger.programError(`${this.constructor.name} unexpected squad leader roles ${squad.leader}`)
    return
  }

  private runDismantleSquad(squad: Season1022818Dismantle2TowerWallProcessSquad, canAttack: boolean): void {
    switch (this.squadStatus) {
    case "moving to target":
      this.moveToNextRoomSquad(squad)
      return

    case "align":
    case "escape":
      this.alignSquad(squad)
      return

    case "dismantle":
      this.dismantleSquad(squad, canAttack)
      return

    case "spawning":
      PrimitiveLogger.programError(`${this.constructor.name} unexpected spawning status`)
      return
    }
  }

  private squadHealerCreeps(squad: Season1022818Dismantle2TowerWallProcessSquad): Creep[] {
    return [
      squad.topRight,
      squad.topLeft,
      squad.bottomLeft
    ]
  }

  private squadCreeps(squad: Season1022818Dismantle2TowerWallProcessSquad): Creep[] {
    return [
      squad.leader,
      ...this.squadHealerCreeps(squad),
    ]
  }

  private everySquadMemberInRoom(squad: Season1022818Dismantle2TowerWallProcessSquad, roomName: RoomName): boolean {
    return this.squadCreeps(squad).every(creep => creep.room.name === roomName)
  }

  private someSquadMemberInRoom(squad: Season1022818Dismantle2TowerWallProcessSquad, roomName: RoomName): boolean {
    return this.squadCreeps(squad).some(creep => creep.room.name === roomName)
  }

  private squadDamage(squad: Season1022818Dismantle2TowerWallProcessSquad): number {
    return this.squadCreeps(squad).reduce((result, current) => {
      return result + (current.hitsMax - current.hits)
    }, 0)
  }

  private isSquadTired(squad: Season1022818Dismantle2TowerWallProcessSquad): boolean {
    return this.squadCreeps(squad).some(creep => creep.fatigue > 0)
  }

  private isSquadLined(squad: Season1022818Dismantle2TowerWallProcessSquad): boolean {
    if (squad.topRight.pos.isNearTo(squad.leader.pos) !== true) {
      return false
    }
    if (squad.bottomLeft.pos.isNearTo(squad.topRight.pos) !== true) {
      return false
    }
    if (squad.topLeft.pos.isNearTo(squad.bottomLeft.pos) !== true) {
      return false
    }
    return true
  }

  private moveToNextRoomSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    this.debugLog("moveToNextRoomSquad")
    if (this.everySquadMemberInRoom(squad, nextRoomName) === true) {
      this.squadStatus = "align"
      this.alignSquad(squad)
      return
    }

    if (this.isSquadTired(squad) === true) {
      return
    }

    if (squad.leader.room.name !== squad.topLeft.room.name) {
      moveToRoom(squad.leader, this.targetRoomName, this.waypoints)
      this.followerMoveToLeaderSquad(squad)
      return
    }

    if (this.isSquadLined(squad) !== true) {
      this.followerMoveToLeaderSquad(squad)
      return
    }

    moveToRoom(squad.leader, this.targetRoomName, this.waypoints)
    this.followerMoveToLeaderSquad(squad)
  }

  private followerMoveToLeaderSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    squad.topRight.moveTo(squad.leader.pos)
    squad.bottomLeft.moveTo(squad.topRight.pos)
    squad.topLeft.moveTo(squad.bottomLeft.pos)
  }

  private alignSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    this.debugLog("alignSquad")

    if (squad.leader.pos.isEqualTo(alignPosition) !== true) {
      if (this.isSquadTired(squad) === true) {
        return
      }
      squad.leader.moveTo(alignPosition)
      this.followerMoveToLeaderSquad(squad)
      return
    }

    const positions = this.squadMemberPositionFor(squad.leader.pos)
    if (positions == null) {
      squad.topRight.say("no pos")
      PrimitiveLogger.fatal(`${this.constructor.name} no member rooms for leader position ${squad.leader.pos}`)
      return
    }
    const {topRight, topLeft, bottomLeft} = positions

    const aligned = ((): boolean => {
      if (squad.topRight.pos.isEqualTo(topRight) !== true) {
        return false
      }
      if (squad.topLeft.pos.isEqualTo(topLeft) !== true) {
        return false
      }
      if (squad.bottomLeft.pos.isEqualTo(bottomLeft) !== true) {
        return false
      }
      return false
    })()

    if (aligned === true) {
      if (this.squadDamage(squad) > 0) {
        return
      }
      this.squadStatus = "dismantle"
      return
    }

    squad.topRight.moveTo(topRight)
    squad.topLeft.moveTo(topLeft)
    squad.bottomLeft.moveTo(bottomLeft)
  }

  private dismantleSquad(squad: Season1022818Dismantle2TowerWallProcessSquad, canAttack: boolean): void {
    const damage = this.squadDamage(squad)
    if (damage > 800) {
      this.squadStatus = "escape"
      this.escapeSquad(squad)
      return
    }

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      const exit = squad.leader.room.findExitTo(this.targetRoomName)
      if (exit === ERR_NO_PATH || exit === ERR_INVALID_ARGS) {
        PrimitiveLogger.fatal(`${this.constructor.name} can't find path to room ${roomLink(this.targetRoomName)}`)
        return
      }
      const exitPosition = squad.leader.pos.findClosestByPath(exit)
      if (exitPosition == null) {
        PrimitiveLogger.fatal(`${this.constructor.name} can't find exit position to room ${roomLink(this.targetRoomName)}, exit: ${exit}`)
        return
      }
      this.moveToPositionAlignedSquad(squad, exitPosition)
      return
    }

    if (squad.leader.pos.isEqualTo(dismantlePosition) !== true) {
      this.moveToPositionAlignedSquad(squad, dismantlePosition)
      return
    }

    const wallType: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    const targetWall = targetWallPosition.findInRange(FIND_STRUCTURES, 0).filter(structure => wallType.includes(structure.structureType))[0] as StructureWall | StructureRampart | null

    if (targetWall == null) {
      processLog(this, `${coloredText("[Finished]", "info")} wall destroyed`)
      return
    }

    squad.leader.dismantle(targetWall)
    if (canAttack) {
      this.squadHealerCreeps(squad).forEach(creep => {
        if (creep.pos.isNearTo(targetWall.pos) === true) {
          creep.rangedMassAttack()
        } else {
          creep.rangedAttack(targetWall)
        }
      })
    }
  }

  private escapeSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    this.alignSquad(squad)
  }

  private squadMemberPositionFor(leaderPosition: RoomPosition): { topRight: RoomPosition, topLeft: RoomPosition, bottomLeft: RoomPosition } | null {
    const topRight = leaderPosition.positionTo(TOP)
    const topLeft = leaderPosition.positionTo(TOP_LEFT)
    const bottomLeft = leaderPosition.positionTo(LEFT)
    if (topRight == null || topLeft == null || bottomLeft == null) {
      return null
    }

    return {
      topRight,
      topLeft,
      bottomLeft
    }
  }

  private moveToPositionAlignedSquad(squad: Season1022818Dismantle2TowerWallProcessSquad, position: RoomPosition): void {
    const path = PathFinder.search(squad.leader.pos, { pos: position, range: 0 }, { maxRooms: 1 })
    if (path.incomplete === true) {
      PrimitiveLogger.fatal(`${this.constructor.name} can't find path to position ${position}, partial path: ${path.path}`)
      return
    }

    const leader = path.path[0]
    if (leader == null) {
      PrimitiveLogger.programError(`${this.constructor.name} path length is 0 (${position})`)
      return
    }
    const positions = this.squadMemberPositionFor(leader)
    if (positions == null) {
      squad.topRight.say("no pos")
      PrimitiveLogger.fatal(`${this.constructor.name} no member rooms for leader position ${leader}`)
      return
    }
    const { topRight, topLeft, bottomLeft } = positions
    squad.topRight.moveTo(topRight)
    squad.topLeft.moveTo(topLeft)
    squad.bottomLeft.moveTo(bottomLeft)
  }

  private healSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    const healableHits = this.healableHits
    const healerCreeps = this.squadHealerCreeps(squad)
    this.squadCreeps(squad)
      .sort((lhs, rhs) => {
        return (rhs.hitsMax - rhs.hits) - (lhs.hitsMax - lhs.hits)
      })
      .forEach(creep => {
        const damage = creep.hitsMax - creep.hits
        const healCount = Math.ceil(damage / healableHits)
        const failedHealers: Creep[] = []
        for (let i = 0; i < healCount; i += 1) {
          const healer = healerCreeps.shift()
          if (healer == null) {
            return
          }
          const result = healer.heal(creep)
          switch (result) {
          case OK:
            break
          case ERR_NOT_IN_RANGE:
            if (healer.rangedHeal(creep) !== OK) {
              PrimitiveLogger.programError(`${this.constructor.name} healer ${healer.name} ${healer.pos} failed to ranged heal ${creep.name} ${creep.pos}`)
              failedHealers.push(healer)
            }
            break
          default:
            PrimitiveLogger.programError(`${this.constructor.name} healer ${healer.name} ${healer.pos} failed to heal ${creep.name} ${creep.pos} with ${result}`)
            failedHealers.push(healer)
          }
        }
        healerCreeps.push(...failedHealers)
      })

    healerCreeps.forEach(healer => {
      healer.heal(healer)
    })
  }

  private attackNearbyHostile(squad: Season1022818Dismantle2TowerWallProcessSquad): boolean {
    const attackBodyParts: BodyPartConstant[] = [ATTACK, RANGED_ATTACK]
    const findHostile = ((position: RoomPosition): Creep | null => {
      const creeps = position.findInRange(FIND_HOSTILE_CREEPS, 3)
      if (creeps.length <= 0) {
        return null
      }
      return creeps.reduce((lhs, rhs) => {
        const attackerL = lhs.body.map(b => b.type).some(body => attackBodyParts.includes(body))
        const attackerR = rhs.body.map(b => b.type).some(body => attackBodyParts.includes(body))
        if (attackerL && attackerR) {
          return position.getRangeTo(lhs) < position.getRangeTo(rhs) ? lhs : rhs
        }
        if (attackerL) {
          return lhs
        }
        if (attackerR) {
          return rhs
        }
        return position.getRangeTo(lhs) < position.getRangeTo(rhs) ? lhs : rhs
      })
    })

    let attacked = false
    this.squadHealerCreeps(squad).forEach(creep => {
      const hostile = findHostile(creep.pos)
      if (hostile == null) {
        return
      }
      attacked = true
      if (hostile.pos.getRangeTo(creep.pos) <= 1) {
        creep.rangedMassAttack()
      } else {
        creep.rangedAttack(hostile)
      }
    })
    return attacked
  }

  private debugLog(message: string): void {
    if (debugLog !== true) {
      return
    }
    processLog(this, message)
  }
}

