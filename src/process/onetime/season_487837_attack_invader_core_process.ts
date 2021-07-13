import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { processLog } from "process/process_log"
import { roomLink } from "utility/log"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { MoveToRoomTask } from "object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { AttackApiWrapper } from "object_task/creep_task/api_wrapper/attack_api_wrapper"
import { OperatingSystem } from "os/os"

const roomName = "W27S26"
const targetRoomName = "W27S27"
const numberOfCreeps = 1

export interface Season487837AttackInvaderCoreProcessState extends ProcessState {
}

// controller.reservation.username = Invader
// invaderCore.level = 0
export class Season487837AttackInvaderCoreProcess implements Process, Procedural {
  private readonly identifier: string
  private readonly codename: string
  private readonly roles: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
  private readonly body: BodyPartConstant[] = [
    MOVE, MOVE,
    ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}_${targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season487837AttackInvaderCoreProcessState {
    return {
      t: "Season487837AttackInvaderCoreProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: Season487837AttackInvaderCoreProcessState): Season487837AttackInvaderCoreProcess | null {
    return new Season487837AttackInvaderCoreProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): Season487837AttackInvaderCoreProcess {
    return new Season487837AttackInvaderCoreProcess(Game.time, processId)
  }

  public runOnTick(): void {
    const creepCount = World.resourcePools.countCreeps(roomName, this.identifier, () => true)
    if (creepCount < numberOfCreeps) {
      this.requestAttacker()
    }

    World.resourcePools.assignTasks(roomName, this.identifier, CreepPoolAssignPriority.Low, creep => this.newAttackerTask(creep), () => true)
  }

  private requestAttacker(): void {
    World.resourcePools.addSpawnCreepRequest(roomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps,
      codename: this.codename,
      roles: this.roles,
      body: this.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private newAttackerTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== targetRoomName) {
      return MoveToRoomTask.create(targetRoomName, [])
    }

    const targetRoom = creep.room
    const invaderCore = targetRoom.find(FIND_HOSTILE_STRUCTURES).find(structure => structure instanceof StructureInvaderCore) as StructureInvaderCore | null

    if (invaderCore == null) {
      processLog(this, `Finished: no invader core ${roomLink(roomName)}`)
      OperatingSystem.os.killProcess(this.processId)
      return null
    }

    return MoveToTargetTask.create(AttackApiWrapper.create(invaderCore))
  }
}
