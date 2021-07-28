import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { BoostApiWrapper } from "v5_object_task/creep_task/api_wrapper/boost_api_wrapper"
import { CreepName } from "prototype/creep"
import { processLog } from "process/process_log"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { moveToRoom } from "script/move_to_room"
import { GameConstants } from "utility/constants"

const testing = false as boolean

type State = "spawning" | "launched"

// const boosts: MineralBoostConstant[] = [
//   RESOURCE_LEMERGIUM_ALKALIDE,
//   RESOURCE_KEANIUM_OXIDE,
// ]

const healBoost = 3

type SquadState = {
  leaderCreepName: CreepName
  followerCreepName: CreepName
}

type Squad = {
  leader: Creep
  follower: Creep
}

export interface Season1143119BoostedAttackProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** target structure id */
  ti: Id<AnyStructure> | null

  state: State
  squadState: SquadState | null
}

// Game.io("launch -l Season1143119BoostedAttackProcess room_name=W14S28 target_room_name=W17S29 waypoints=W14S30,W17S30")
export class Season1143119BoostedAttackProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly attackerRoles: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
  private readonly attackerBody: BodyPartConstant[] = [
    TOUGH, TOUGH, TOUGH,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL,
  ]

  private readonly scoutBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private targetId: Id<AnyStructure> | null,
    private squadState: SquadState | null,
    private state: State,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1143119BoostedAttackProcessState {
    return {
      t: "Season1143119BoostedAttackProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      ti: this.targetId,
      squadState: this.squadState,
      state: this.state,
    }
  }

  public static decode(state: Season1143119BoostedAttackProcessState): Season1143119BoostedAttackProcess {
    return new Season1143119BoostedAttackProcess(state.l, state.i, state.p, state.tr, state.w, state.ti, state.squadState, state.state)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season1143119BoostedAttackProcess {
    return new Season1143119BoostedAttackProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, null, "spawning")
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    if (this.squadState != null) {
      const leader = Game.creeps[this.squadState.leaderCreepName]
      const follower = Game.creeps[this.squadState.followerCreepName]
      if (leader != null && follower != null) {
        const squad: Squad = { leader, follower }
        this.runSquad(squad)
        return
      }
      if (leader != null) {
        this.runSingleAttacker(leader)
        return
      }
      if (follower != null) {
        this.runSingleAttacker(follower)
        return
      }
      processLog(this, "Squad dead")
      return
    }

    const room = Game.rooms[this.parentRoomName]
    if (room == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      return
    }

    this.spawn(room)
  }

  private spawn(room: Room): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    const leader = creeps[0]
    const follower = creeps[1]
    if (leader != null && follower != null) {
      this.squadState = {
        leaderCreepName: leader.name,
        followerCreepName: follower.name,
      }
      this.state = "launched"
      return
    }
    const labs = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[]
    const priority = creeps.length > 0 ? CreepSpawnRequestPriority.Urgent : CreepSpawnRequestPriority.Low
    this.requestAttacker(priority, 1, labs)
  }

  private requestAttacker(priority: CreepSpawnRequestPriority, numberOfCreeps: number, labs: StructureLab[]): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: testing ? CreepSpawnRequestPriority.Urgent : priority,
      numberOfCreeps,
      codename: this.codename,
      roles: this.attackerRoles,
      body: testing ? [TOUGH, MOVE] : this.attackerBody,
      initialTask: testing ? null : this.boostTask(labs),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private boostTask(labs: StructureLab[]): CreepTask {
    const options: SequentialTaskOptions = {
      ignoreFailure: false,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = labs.map(lab => MoveToTargetTask.create(BoostApiWrapper.create(lab)))
    return SequentialTask.create(tasks, options)
  }

  private runSquad(squad: Squad): void {
    const movement = this.attackHostileSquad(squad)
    this.healSquad(squad.leader, squad.follower)

    if (movement.moved === true) {
      return
    }

    if (squad.leader.v5task != null || squad.follower.v5task != null) {
      return
    }

    if (squad.leader.room.name !== this.targetRoomName) {
      if (this.leaderCanMove(squad.leader, squad.follower) === true) {  // 部屋をまたぐ際にfalseになるかも
        moveToRoom(squad.leader, this.targetRoomName, this.waypoints)
      }
      squad.follower.moveTo(squad.leader)
      return
    }

    const target = ((): AnyStructure | null => {
      if (this.targetId != null) {
        const stored = Game.getObjectById(this.targetId)
        if (stored != null) {
          return stored
        }
      }
      return this.targetStructure(squad.leader.room)
    })()
    this.targetId = target?.id ?? null

    if (target != null) {
      if (this.leaderCanMove(squad.leader, squad.follower) === true) {
        squad.leader.moveTo(target)
      }
      squad.follower.moveTo(squad.leader)

      this.rangedAttack(squad.leader, target)
      this.rangedAttack(squad.follower, target)
    } else {
      processLog(this, `${roomLink(this.targetRoomName)} destroyed`)
    }
  }

  private runSingleAttacker(creep: Creep): void {
    const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
    if (target == null) {
      return
    }

  }

  // ---- Squad ---- //
  private attackHostileSquad(squad: Squad): {attacked: boolean, moved: boolean} {
    let attacked = false
    let moved = false
    const leaderClosestHostile = this.closestHostile(squad.leader.pos)
    if (leaderClosestHostile != null) {
      this.rangedAttack(squad.leader, leaderClosestHostile)
      attacked = true

      if (leaderClosestHostile.getActiveBodyparts(ATTACK) > 0 && leaderClosestHostile.pos.getRangeTo(squad.leader) <= 2) {
        if (this.leaderCanMove(squad.leader, squad.follower) === true) {
          this.fleeFrom(leaderClosestHostile.pos, squad.leader, 4)
        }
        squad.follower.moveTo(squad.leader)
        moved = true
      }
    }

    const followerClosestHostile = this.closestHostile(squad.follower.pos)
    if (followerClosestHostile != null) {
      this.rangedAttack(squad.follower, followerClosestHostile)
      attacked = true
    }
    return { attacked, moved }
  }

  private healSquad(leaderCreep: Creep, followerCreep: Creep): boolean {
    const healableHits = HEAL_POWER * 9 * healBoost
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
      const leaderPos = leaderCreep.pos
      const min = GameConstants.room.edgePosition.min
      const max = GameConstants.room.edgePosition.max
      if (leaderCreep.room.name === followerCreep.room.name || (leaderPos.x !== min && leaderPos.x !== max && leaderPos.y !== min && leaderPos.y !== max)) {
        return false
      }
    }
    return followerCreep.fatigue <= 0
  }

  // ---- Functions ---- //
  private closestHostile(position: RoomPosition): Creep | null {
    const hostiles = position.findInRange(FIND_HOSTILE_CREEPS, 4)
    if (hostiles.length <= 0) {
      return null
    }
    return hostiles.reduce((lhs, rhs) => {
      return position.getRangeTo(lhs.pos) < position.getRangeTo(rhs.pos) ? lhs : rhs
    })
  }

  private targetStructure(room: Room): AnyStructure | null {
    const priority: StructureConstant[] = [
      STRUCTURE_SPAWN,  // 添字の大きい方が優先
      STRUCTURE_TOWER,
    ]
    const excluded: StructureConstant[] = [
      STRUCTURE_CONTROLLER,
    ]
    return room.find(FIND_HOSTILE_STRUCTURES)
      .filter(structure => excluded.includes(structure.structureType) !== true)
      .sort((lhs, rhs) => {
        return priority.indexOf(rhs.structureType) - priority.indexOf(lhs.structureType)
      })[0] ?? null
  }

  private rangedAttack(creep: Creep, target: AnyCreep | AnyStructure): void {
    if (creep.pos.isNearTo(target.pos) === true) {
      creep.rangedMassAttack()
    } else {
      creep.rangedAttack(target)
    }
  }

  private fleeFrom(position: RoomPosition, creep: Creep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 1,
    })
    creep.moveByPath(path.path)
  }
}
