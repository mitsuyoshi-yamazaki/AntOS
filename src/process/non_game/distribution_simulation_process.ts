/**
 # DistributionSimulationProcess
 ## 概要
 野菜の卸し業者が注文書に従い流れ作業で野菜を箱詰めするシミュレーション

 ## 要件
 - 注文書
   - 野菜ごとの必要量が記述されている
 - ベルトコンベア

 ## 仕様
 - 野菜は各種Resourceで表現する
 - 箱はCreepで表現する
 - 箱詰め要員はCreepで表現する
 - （Screepsの仕様で許可されている）対角線上のオブジェクトにはアクセスできない
 */

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { CreepName } from "prototype/creep"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { OperatingSystem } from "os/os"

ProcessDecoder.register("DistributionSimulationProcess", state => {
  return DistributionSimulationProcess.decode(state as DistributionSimulationProcessState)
})

interface DistributionSimulationProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly creepName: CreepName | null
}

export class DistributionSimulationProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private creepName: CreepName | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DistributionSimulationProcessState {
    return {
      t: "DistributionSimulationProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      creepName: this.creepName,
    }
  }

  public static decode(state: DistributionSimulationProcessState): DistributionSimulationProcess {
    return new DistributionSimulationProcess(state.l, state.i, state.roomName, state.targetRoomName, state.creepName)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): DistributionSimulationProcess {
    return new DistributionSimulationProcess(Game.time, processId, roomName, targetRoomName, null)
  }

  public processShortDescription(): string {
    const creepDescription = ((): string => {
      if (this.creepName == null) {
        return "not spawned"
      }
      const creep = Game.creeps[this.creepName]
      if (creep == null) {
        return "creep died"
      }
      return `1cr in ${roomLink(creep.room.name)}`
    })()
    return `${roomLink(this.targetRoomName)}, ${creepDescription}`
  }

  public runOnTick(): void {
    if (this.creepName == null) {
      const scout = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)[0]
      if (scout != null) {
        this.creepName = scout.name
      }
    } else {
      if (Game.creeps[this.creepName] == null) {
        OperatingSystem.os.killProcess(this.processId)
      }
    }

    if (this.creepName == null) {
      World.resourcePools.addSpawnCreepRequest(this.roomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [CreepRole.Scout],
        body: [MOVE],
        initialTask: null,
        taskIdentifier: this.identifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      () => this.scoutTask(),
      () => true,
    )
  }

  private scoutTask(): CreepTask {
    return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, []))
  }
}
