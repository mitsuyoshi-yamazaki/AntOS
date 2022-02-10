import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { AttackApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_api_wrapper"
import { RoomName } from "utility/room_name"
import { processLog } from "os/infrastructure/logger"
import { roomLink } from "utility/log"
import { bodyCost } from "utility/creep_body"
import { ProcessDecoder } from "process/process_decoder"
import { RoomResources } from "room_resource/room_resources"
import { GclFarmResources } from "room_resource/gcl_farm_resources"

ProcessDecoder.register("Season487837AttackInvaderCoreProcess", state => {
  return Season487837AttackInvaderCoreProcess.decode(state as Season487837AttackInvaderCoreProcessState)
})

const numberOfAttackers = 1

export interface Season487837AttackInvaderCoreProcessState extends ProcessState {
}

// controller.reservation.username = Invader
// invaderCore.level = 0
export class Season487837AttackInvaderCoreProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string
  private readonly roles: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
  private readonly body: BodyPartConstant[] = [ // costs 1040 >= RCL4
    MOVE, MOVE, MOVE, MOVE,
    ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
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
    const invadedRoomNames: RoomName[] = []
    const parentRoomResources = RoomResources.getOwnedRoomResources().filter(resource => {
      if (GclFarmResources.isGclFarm(resource.room.name) === true) {
        return false
      }
      return true
    })

    parentRoomResources.forEach(roomResource => {
      const targetRoomNames = Array.from(Object.entries(roomResource.roomInfo.remoteRoomInfo)).flatMap(([roomName, roomInfo]): RoomName[] => {
        if (roomInfo.enabled !== true) {
          return []
        }
        return [roomName]
      })
      invadedRoomNames.push(...this.runOnRoom(roomResource.room.name, targetRoomNames))
    })

    if (invadedRoomNames.length > 0) {
      processLog(this, `Invaded rooms: ${invadedRoomNames.map(roomName => roomLink(roomName)).join(",")}`)
    }
  }

  private runOnRoom(parentRoomName: RoomName, targetRoomNames: RoomName[]): RoomName[] {
    const invadedRoomNames: RoomName[] = []

    targetRoomNames.forEach(targetRoomName => {
      if (this.runOnTargetRoom(parentRoomName, targetRoomName) === true) {
        invadedRoomNames.push(targetRoomName)
      }
    })
    return invadedRoomNames
  }

  private runOnTargetRoom(parentRoomName: RoomName, targetRoomName: RoomName): boolean {
    const targetRoom = Game.rooms[targetRoomName]
    if (targetRoom == null) {
      return false
    }

    const invaderCore = targetRoom.find(FIND_HOSTILE_STRUCTURES).find(structure => structure instanceof StructureInvaderCore) as StructureInvaderCore | null
    if (invaderCore == null) {
      return false
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
    return true
  }

  private requestAttacker(parentRoomName: RoomName, identifier: string): void {
    const room = Game.rooms[parentRoomName]
    if (room == null || bodyCost(this.body) > room.energyCapacityAvailable) {
      return
    }

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
