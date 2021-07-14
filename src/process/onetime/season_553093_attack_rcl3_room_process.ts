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
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { AttackApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_api_wrapper"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"

// const targetWallId = "60ee3b19a19fa507e2abab13" as Id<StructureWall>

const numberOfAttackers = 3

export interface Season553093AttackRcl3RoomProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** target structure id */
  ti: Id<AnyStructure> | null

  /** target creep id */
  tc: Id<AnyCreep> | null
}

export class Season553093AttackRcl3RoomProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly attackerRoles: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
  private readonly attackerBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE,
    ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE,
    HEAL,
  ]

  private readonly dismantlerRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]
  private readonly dismantlerBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE,
    WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private target: AnyStructure | null,
    private targetCreep: AnyCreep | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season553093AttackRcl3RoomProcessState {
    return {
      t: "Season553093AttackRcl3RoomProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      ti: this.target?.id ?? null,
      tc: this.targetCreep?.id ?? null,
    }
  }

  public static decode(state: Season553093AttackRcl3RoomProcessState): Season553093AttackRcl3RoomProcess {
    const target = ((): AnyStructure | null => {
      if (state.ti == null) {
        return null
      }
      return Game.getObjectById(state.ti)
    })()
    const targetCreep = ((): AnyCreep | null => {
      if (state.tc == null) {
        return null
      }
      return Game.getObjectById(state.tc)
    })()
    return new Season553093AttackRcl3RoomProcess(state.l, state.i, state.p, state.tr, state.w, target, targetCreep)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season553093AttackRcl3RoomProcess {
    return new Season553093AttackRcl3RoomProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, null)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const insufficientCreepCount = numberOfAttackers - creepCount
    if (insufficientCreepCount > 0) {
      const priority: CreepSpawnRequestPriority = insufficientCreepCount > 2 ? CreepSpawnRequestPriority.High : CreepSpawnRequestPriority.Low
      this.requestAttacker(priority, insufficientCreepCount)
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newAttackerTask(creep),
      () => true,
    )
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

  private newAttackerTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const attackerTarget = ((): AnyCreep | AnyStructure | null => {
      // const storedWall = Game.getObjectById(targetWallId)
      // if (storedWall != null) {
      //   this.target = storedWall
      //   return storedWall
      // }
      if (this.targetCreep != null) {
        return this.targetCreep
      }
      if (this.target != null) {
        return this.target
      }
      const hostileCreep = this.newTargetCreep(creep)
      if (hostileCreep != null) {
        return hostileCreep
      }
      return this.structureTarget(creep.room)
    })()

    if (attackerTarget == null) {
      if (creep.room.controller != null) {
        return MoveToTask.create(creep.room.controller.pos, 2)
      }
      return null
    }

    return MoveToTargetTask.create(AttackApiWrapper.create(attackerTarget))
  }

  private newTargetCreep(creep: Creep): AnyCreep | null {
    const targetBodyParts: BodyPartConstant[] = [ATTACK, RANGED_ATTACK]
    const hostileCreep = creep.pos.findClosestByRange(
      creep.room.find(FIND_HOSTILE_CREEPS).filter(creep => creep.body.some(body => targetBodyParts.includes(body.type)))
    )
    return hostileCreep
    // if (hostileCreep == null) {
    //   return null
    // }

    // const options: FindPathOpts = {
    //   ignoreCreeps: true,
    //   ignoreDestructibleStructures: false,
    //   ignoreRoads: true,
    //   maxRooms: 0,
    // }
    // const path = creep.pos.findPathTo(hostileCreep.pos, options)
    // if (path.length > 0) {
    //   return hostileCreep
    // }
  }

  private structureTarget(room: Room): AnyStructure | null {
    const structures = room.find(FIND_HOSTILE_STRUCTURES)
    const spawn = structures.find(structure => structure instanceof StructureSpawn)
    if (spawn != null) {
      return spawn
    }
    const extension = structures.find(structure => structure instanceof StructureExtension)
    return extension ?? null
  }
}
