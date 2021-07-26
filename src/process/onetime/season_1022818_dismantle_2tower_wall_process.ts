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

type SquadState = "spawning" | "moving to target" | "align" | "dismantle" | "escape"

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

  squad: Season1022818Dismantle2TowerWallProcessSquadState | null
  downgraderWaypoints: RoomName[]
}

// Game.io("launch -l Season1022818Dismantle2TowerWallProcess room_name=W14S28 target_room_name=W12S29 waypoints=W14S30,W12S30")

// for RCL7
export class Season1022818Dismantle2TowerWallProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly testBody: BodyPartConstant[] = [MOVE]

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
    private squadState: Season1022818Dismantle2TowerWallProcessSquadState | null,
    private launched: boolean,
    private rampartDestroyed: boolean,
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
      squad: this.squadState,
      launched: this.launched,
      rampartDestroyed: this.rampartDestroyed,
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
    return new Season1022818Dismantle2TowerWallProcess(state.l, state.i, state.p, state.tr, state.w, waitingPosition, target, state.squad, state.launched, state.rampartDestroyed, state.downgraderWaypoints)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], waitingPosition: RoomPosition): Season1022818Dismantle2TowerWallProcess {
    return new Season1022818Dismantle2TowerWallProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, waitingPosition, null, null, false, false, [...waypoints])
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    let dismantler: Creep | null = null
    let downgrader: Creep | null = null
    const healers: Creep[] = []
    for (const creep of creeps) {
      if (hasNecessaryRoles(creep, this.dismantlerRoles) === true) {
        dismantler = creep
        continue
      }
      if (hasNecessaryRoles(creep, this.downgraderRoles) === true) {
        downgrader = creep
        continue
      }
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

    if (squad == null && this.launched !== true) {
      if (dismantler == null) {
        this.requestCreep(this.dismantlerRoles, this.dismantlerBody)
        processLog(this, `${coloredText("[Spawn]", "info")} dismantler`)
      } else if (healers.length < 3) {
        this.requestCreep(this.healerRoles, this.healerBody)
        processLog(this, `${coloredText("[Spawn]", "info")} healer(${healers.length + 1}/3)`)
      }
    } else {
      if (this.rampartDestroyed === true && downgrader == null) {
        this.requestCreep(this.downgraderRoles, this.downgraderBody)
        processLog(this, `${coloredText("[Spawn]", "info")} downgrader`)
      }
    }

    this.debugLog(`dismantler: ${dismantler}, downgrader: ${downgrader}, haulers: ${healers.length}, launched: ${this.launched}, rampart: ${this.rampartDestroyed}`)

    if (squad == null) {
      squad = this.constructDismantlerSquad(dismantler, healers)
    }
    if (squad != null) {
      const canAttack = this.attackNearbyHostile(squad)
      this.runSquad(squad, downgrader, canAttack)
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

  private runSquad(squad: Season1022818Dismantle2TowerWallProcessSquad, downgrader: Creep | null, canAttack: boolean): void {
    if (hasNecessaryRoles(squad.leader, this.dismantlerRoles) === true) {
      this.runDismantleSquad(squad, downgrader, canAttack)
      return
    }
    if (hasNecessaryRoles(squad.leader, this.downgraderRoles) === true) {
      this.runDowngradeSquad(squad, canAttack)
      return
    }
    PrimitiveLogger.programError(`${this.constructor.name} unexpected squad leader roles`)
    return
  }

  private runDismantleSquad(squad: Season1022818Dismantle2TowerWallProcessSquad, downgrader: Creep | null, canAttack: boolean): void {
    this.launched = true
    if (this.squadInRoom(squad, this.targetRoomName) !== true) {
      if (downgrader != null) {
        this.receiveDowngrader(squad, downgrader)
        return
      }

      this.moveToTargetRoomSquad(squad)
      return
    }

    const damage = this.squadDamage(squad)
    if (damage > 800) {
      this.escapeSquad(squad)
      return
    }

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      PrimitiveLogger.programError(`${this.constructor.name} unexpectedly invisible target room`)
      return
    }
    const wallType: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    const targetWall = targetWallPosition.findInRange(FIND_STRUCTURES, 0).filter(structure => wallType.includes(structure.structureType))[0] as StructureWall | StructureRampart | null

    if (targetWall == null) {
      this.rampartDestroyed = true

      if (downgrader != null && downgrader.room.name === nextRoomName) {
        this.receiveDowngrader(squad, downgrader)
        return
      }
    }

    if (this.squadPosition(squad).isEqualTo(dismantlePosition) !== true) {
      // TODO:
    }

    // TODO:
  }

  private receiveDowngrader(squad: Season1022818Dismantle2TowerWallProcessSquad, downgrader: Creep): void {
    this.debugLog("receiveDowngrader")
    // TODO:
  }

  private runDowngradeSquad(squad: Season1022818Dismantle2TowerWallProcessSquad, canAttack: boolean): void {
    this.debugLog("runDowngradeSquad")

    // TODO:
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

  private squadInRoom(squad: Season1022818Dismantle2TowerWallProcessSquad, roomName: RoomName): boolean {
    return this.squadCreeps(squad).every(creep => creep.room.name === roomName)
  }

  private squadPosition(squad: Season1022818Dismantle2TowerWallProcessSquad): RoomPosition {
    return squad.leader.pos
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

  private moveToTargetRoomSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    this.debugLog("moveToTargetRoomSquad")
    if (this.isSquadTired(squad) === true) {
      return
    }

    const moveFollowers = (): void => {
      squad.topRight.moveTo(squad.leader.pos)
      squad.bottomLeft.moveTo(squad.topRight.pos)
      squad.topLeft.moveTo(squad.bottomLeft.pos)
    }

    if (squad.leader.room.name !== squad.topLeft.room.name) {
      moveToRoom(squad.leader, this.targetRoomName, this.waypoints)
      moveFollowers()
      return
    }

    if (this.isSquadLined(squad) !== true) {
      moveFollowers()
      return
    }

    moveToRoom(squad.leader, this.targetRoomName, this.waypoints)
    moveFollowers()
  }

  private escapeSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    this.debugLog("escapeSquad")
    // TODO:
  }

  private moveToPositionSquad(squad: Season1022818Dismantle2TowerWallProcessSquad): void {
    // TODO:
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

  // // ----
  // private runSquadddd(leaderCreep: Creep, followerCreep: Creep, waypoints: RoomName[]): void {
  //   if (leaderCreep.room.name !== followerCreep.room.name) {
  //     this.moveIntoRoom(leaderCreep)
  //     followerCreep.moveTo(leaderCreep.pos)
  //     this.attackNearbyCreeps(leaderCreep, followerCreep)
  //     leaderCreep.rangedAttack
  //     leaderCreep.heal(leaderCreep)
  //     followerCreep.heal(followerCreep)
  //     return
  //   }

  //   if (leaderCreep.room.name === this.targetRoomName) {
  //     this.attackSquad(leaderCreep, followerCreep)
  //     return
  //   }

  //   if (this.healSquad(leaderCreep, followerCreep) !== true) {
  //     if (this.leaderCanMove(leaderCreep, followerCreep) === true) {
  //       this.moveToRoom(leaderCreep, waypoints)
  //     }
  //   }
  //   followerCreep.moveTo(leaderCreep.pos)
  //   this.attackNearbyCreeps(leaderCreep, followerCreep)
  // }

  // private attackSquad(leaderCreep: Creep, followerCreep: Creep): void {
  //   const attacked = this.attackNearbyCreeps(leaderCreep, followerCreep)

  //   const room = leaderCreep.room
  //   const structures = room.find(FIND_HOSTILE_STRUCTURES).filter(structure => structure.structureType !== STRUCTURE_CONTROLLER)
  //   const tower = structures.find(structure => structure.structureType === STRUCTURE_TOWER) as StructureTower | null
  //   if (tower != null) {
  //     if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
  //       this.drainTower(tower, leaderCreep, followerCreep)
  //       return
  //     }
  //     if (attacked !== true) {
  //       this.attack(tower, leaderCreep, followerCreep)
  //     }
  //     return
  //   }

  //   if (attacked !== true) {
  //     const spawn = structures.find(structure => structure.structureType === STRUCTURE_SPAWN) as StructureSpawn | null
  //     if (spawn != null) {
  //       this.attack(spawn, leaderCreep, followerCreep)
  //       return
  //     }
  //   }

  //   const structure = leaderCreep.pos.findClosestByPath(structures)
  //   if (structure != null) {
  //     this.attack(structure, leaderCreep, followerCreep)
  //     return
  //   }

  //   leaderCreep.say("done")
  // }

  // private drainTower(tower: StructureTower, leaderCreep: Creep, followerCreep: Creep): void {
  //   processLog(this, `Drain tower ${Math.ceil(tower.store.getUsedCapacity(RESOURCE_ENERGY) / 100) * 100}`)
  //   if (this.attackNearbyCreeps(leaderCreep, followerCreep) !== true) {
  //     leaderCreep.rangedAttack(tower)
  //     followerCreep.rangedAttack(tower)
  //   }
  //   this.healSquad(leaderCreep, followerCreep)

  //   if (this.leaderCanMove(leaderCreep, followerCreep) === true) {
  //     const shouldFlee = leaderCreep.hits < (leaderCreep.hitsMax * 0.8) || followerCreep.hits < (followerCreep.hitsMax * 0.8)
  //     if (shouldFlee !== true) {
  //       leaderCreep.moveTo(44, 24)
  //     } else {
  //       const exitPosition = leaderCreep.pos.findClosestByPath(FIND_EXIT)
  //       if (exitPosition == null) {
  //         leaderCreep.say("no exit")  // TODO:
  //         return
  //       }

  //       if (leaderCreep.pos.isNearTo(exitPosition) !== true) {
  //         leaderCreep.moveTo(exitPosition)
  //       } else {
  //         if (shouldFlee) {
  //           leaderCreep.moveTo(exitPosition)
  //         }
  //       }
  //     }
  //   }
  //   followerCreep.moveTo(leaderCreep.pos)
  // }

  // private attack(target: AnyStructure, leaderCreep: Creep, followerCreep: Creep): void {
  //   processLog(this, `Attack ${target}`)
  //   if (this.attackNearbyCreeps(leaderCreep, followerCreep) !== true) {
  //     if (leaderCreep.pos.getRangeTo(target) <= 3) {
  //       leaderCreep.rangedAttack(target)
  //       followerCreep.rangedAttack(target)
  //     } else {
  //       leaderCreep.rangedMassAttack()
  //       followerCreep.rangedMassAttack()
  //     }
  //   }

  //   this.healSquad(leaderCreep, followerCreep)
  //   if (this.leaderCanMove(leaderCreep, followerCreep) === true) {
  //     leaderCreep.moveTo(target)
  //   }
  //   followerCreep.moveTo(leaderCreep)
  // }

  // private leaderCanMove(leaderCreep: Creep, followerCreep: Creep): boolean {
  //   if (leaderCreep.pos.isNearTo(followerCreep.pos) !== true) {
  //     return false
  //   }
  //   return followerCreep.fatigue <= 0
  // }

  // private runCollapsedSquad(creep: Creep): void {
  //   creep.say("alone")
  // }

  // private moveIntoRoom(creep: Creep): void {
  //   const directionIndex = (Game.time + this.launchTime) % 3

  //   if (creep.pos.x === 0) {
  //     creep.move([RIGHT, TOP_RIGHT, BOTTOM_RIGHT][directionIndex] ?? RIGHT)
  //   } else if (creep.pos.x === 1 || creep.pos.x === 48) {
  //     creep.move([TOP, BOTTOM, TOP][directionIndex] ?? TOP)
  //   } else if (creep.pos.x === 49) {
  //     creep.move([LEFT, TOP_LEFT, BOTTOM_LEFT][directionIndex] ?? LEFT)
  //   } else if (creep.pos.y === 0) {
  //     creep.move([BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT][directionIndex] ?? BOTTOM)
  //   } else if (creep.pos.y === 1 || creep.pos.y === 48) {
  //     creep.move([LEFT, RIGHT, LEFT][directionIndex] ?? LEFT)
  //   } else if (creep.pos.y === 49) {
  //     creep.move([TOP, TOP_LEFT, TOP_RIGHT][directionIndex] ?? TOP)
  //   }
  // }
}

