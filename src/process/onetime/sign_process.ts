import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { ProcessDecoder } from "process/process_decoder"
import { CreepName } from "prototype/creep"
import { OperatingSystem } from "os/os"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { GameMap } from "game/game_map"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { SignApiWrapper } from "v5_object_task/creep_task/api_wrapper/sign_controller_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { Sign } from "game/sign"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"

ProcessDecoder.register("SignProcess", state => {
  return SignProcess.decode(state as SignProcessState)
})

type SignMyRoom = {
  readonly case: "my room"
  readonly sign?: string
}
type SignNormalRoom = {
  readonly case: "normal"
  readonly sign: string
}
export type SignProcessSign = SignMyRoom | SignNormalRoom

export interface SignProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly sign: SignProcessSign
  readonly creepName: CreepName | null
}

export class SignProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly sign: SignProcessSign,
    private creepName: CreepName | null,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): SignProcessState {
    return {
      t: "SignProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      sign: this.sign,
      creepName: this.creepName,
    }
  }

  public static decode(state: SignProcessState): SignProcess {
    return new SignProcess(state.l, state.i, state.roomName, state.targetRoomName, state.sign, state.creepName)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, sign: SignProcessSign): SignProcess {
    return new SignProcess(Game.time, processId, roomName, targetRoomName, sign, null)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)} =&gt `,
    ]
    switch (this.sign.case) {
    case "my room":
      if (this.sign.sign != null) {
        descriptions.push(`my room ${this.sign.sign}`)
      } else {
        descriptions.push("my room")
      }
      break
    case "normal":
      descriptions.push(`${roomLink(this.targetRoomName)} ${this.sign.sign}`)
      break
    }
    return descriptions.join(" ")
  }

  public runOnTick(): void {
    const signCreep = ((): Creep | null => {
      if (this.creepName == null) {
        return null
      }
      return Game.creeps[this.creepName] ?? null
    })()

    if (signCreep == null && this.creepName != null) {
      OperatingSystem.os.killProcess(this.processId)
      return
    }

    if (signCreep == null) {
      const creeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
      const creep = creeps[0]

      if (creep != null) {
        this.creepName = creep.name
      } else {
        World.resourcePools.addSpawnCreepRequest(this.roomName, {
          priority: CreepSpawnRequestPriority.Low,
          numberOfCreeps: 1,
          codename: this.codename,
          roles: [],
          body: [MOVE],
          initialTask: null,
          taskIdentifier: this.taskIdentifier,
          parentRoomName: null,
        })
      }
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTask(creep),
      () => true,
    )
  }

  private newTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
      return MoveToRoomTask.create(this.targetRoomName, waypoints)
    }

    const controller = creep.room.controller
    if (controller == null) {
      return RunApiTask.create(SuicideApiWrapper.create())
    }

    if (controller.sign != null && controller.sign.username === Game.user.name && (Game.time - controller.sign.time) <= 1) {
      return RunApiTask.create(SuicideApiWrapper.create())
    }

    const sign = ((): string => {
      switch (this.sign.case) {
      case "my room":
        return this.sign.sign ?? Sign.signForOwnedRoom()
      case "normal":
        return this.sign.sign
      }
    })()

    return MoveToTargetTask.create(SignApiWrapper.create(controller, sign))
  }
}
