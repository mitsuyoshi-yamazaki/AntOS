import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { RoomName } from "utility/room_name"
import { ProcessState } from "process/process_state"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { processLog } from "process/process_log"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { AttackApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_api_wrapper"

export interface Season617434PowerHarvestProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]
}

// Game.io("launch -l Season617434PowerHarvestProcess room_name=W9S24 target_room_name=W10S24")
// Game.io("launch -l Season617434PowerHarvestProcess room_name=W24S29 target_room_name=W25S30")
export class Season617434PowerHarvestProcess implements Process, Procedural {
  private readonly identifier: string
  private readonly codename: string

  private readonly scoutCount = 1
  private readonly scoutRole = [CreepRole.Scout]
  private readonly scoutBody = [MOVE]

  private readonly attackerCount = 3
  private readonly attackerRole = [CreepRole.Attacker, CreepRole.Mover]
  private readonly attackerBody = [
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season617434PowerHarvestProcessState {
    return {
      t: "Season617434PowerHarvestProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
    }
  }

  public static decode(state: Season617434PowerHarvestProcessState): Season617434PowerHarvestProcess | null {
    return new Season617434PowerHarvestProcess(state.l, state.i, state.p, state.tr, state.w ?? ["W24S30"])
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season617434PowerHarvestProcess {
    return new Season617434PowerHarvestProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    let scoutCount = 0
    let attackerCount = 0

    scoutCount = this.countCreep(this.scoutRole)
    attackerCount = this.countCreep(this.attackerRole)

    if (targetRoom == null) {
      if (scoutCount <= this.scoutCount) {
        this.addScout()
      }
    } else {
      const powerBank = targetRoom.find(FIND_STRUCTURES).find(structure => structure.structureType === STRUCTURE_POWER_BANK) as StructurePowerBank | null

      if (powerBank != null) {
        if (attackerCount < this.attackerCount) {
          this.addAttacker()
        }
        this.runAttackers(powerBank)
      }
    }

    this.runScout()

    processLog(this, `${roomLink(this.targetRoomName)} ${scoutCount} scouts, ${attackerCount} attackers`)
  }

  // ---- Attacker ---- //
  private addAttacker(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: this.attackerCount,
      codename: this.codename,
      roles: this.attackerRole,
      body: this.attackerBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runAttackers(powerBank: StructurePowerBank): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.attackerTask(creep, powerBank),
      creep => hasNecessaryRoles(creep, this.attackerRole),
    )
  }

  private attackerTask(creep: Creep, powerBank: StructurePowerBank): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToTargetTask.create(AttackApiWrapper.create(powerBank)),
      MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 4), // TODO: Controller付近にでも行かせる
    ]
    return SequentialTask.create(tasks, options)
  }

  // ---- Scout ---- //
  private addScout(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: this.scoutCount,
      codename: this.codename,
      roles: this.scoutRole,
      body: this.scoutBody,
      initialTask: this.scoutTask(),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runScout(): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      () => this.scoutTask(),
      creep => hasNecessaryRoles(creep, this.scoutRole),
    )
  }

  private scoutTask(): CreepTask {
    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, []),
      MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 10), // TODO: Controller付近にでも行かせる
      EndlessTask.create(),
    ]
    return SequentialTask.create(tasks, options)
  }

  // ---- Functions ---- //
  private countCreep(roles: CreepRole[]): number {
    return World.resourcePools.countCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, roles))
  }
}
