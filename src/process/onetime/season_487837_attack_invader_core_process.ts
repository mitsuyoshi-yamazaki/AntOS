import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { MoveToRoomTask } from "object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { AttackApiWrapper } from "object_task/creep_task/api_wrapper/attack_api_wrapper"
import { RoomName } from "utility/room_name"

const roomNames = new Map<RoomName, RoomName[]>([
  ["W27S26", ["W28S26", "W27S27"]],
  ["W24S29", ["W25S29", "W23S29"]],
  ["W14S28", ["W15S28"]],
])
const numberOfAttackers = 1

export interface Season487837AttackInvaderCoreProcessState extends ProcessState {
}

// controller.reservation.username = Invader
// invaderCore.level = 0
export class Season487837AttackInvaderCoreProcess implements Process, Procedural {
  private readonly codename: string
  private readonly roles: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
  private readonly body: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE,
    ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.codename = generateCodename(this.constructor.name, this.launchTime)
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
    roomNames.forEach((targetRoomNames, parentRoomName) => {
      this.runOnRoom(parentRoomName, targetRoomNames)
    })
  }

  private runOnRoom(parentRoomName: RoomName, targetRoomNames: RoomName[]): void {
    targetRoomNames.forEach(targetRoomName => {
      this.runOnTargetRoom(parentRoomName, targetRoomName)
    })
  }

  private runOnTargetRoom(parentRoomName: RoomName, targetRoomName: RoomName): void {
    const targetRoom = Game.rooms[targetRoomName]
    if (targetRoom == null) {
      return
    }

    const invaderCore = targetRoom.find(FIND_HOSTILE_STRUCTURES).find(structure => structure instanceof StructureInvaderCore) as StructureInvaderCore | null
    if (invaderCore == null) {
      return
    }

    const identifier = `${this.constructor.name}_${parentRoomName}_${targetRoomName}`
    const creepCount = World.resourcePools.countCreeps(parentRoomName, identifier, () => true)
    if (creepCount < numberOfAttackers) {
      this.requestAttacker(parentRoomName, identifier)
    }

    World.resourcePools.assignTasks(
      parentRoomName,
      identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newAttackerTask(creep, targetRoom, invaderCore),
      () => true,
    )
  }

  private requestAttacker(parentRoomName: RoomName, identifier: string): void {
    World.resourcePools.addSpawnCreepRequest(parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: numberOfAttackers,
      codename: this.codename,
      roles: this.roles,
      body: this.body,
      initialTask: null,
      taskIdentifier: identifier,
      parentRoomName: null,
    })
  }

  private newAttackerTask(creep: Creep, targetRoom: Room, invaderCore: StructureInvaderCore): CreepTask | null {
    if (creep.room.name !== targetRoom.name) {
      return MoveToRoomTask.create(targetRoom.name, [])
    }
    return MoveToTargetTask.create(AttackApiWrapper.create(invaderCore))
  }
}
