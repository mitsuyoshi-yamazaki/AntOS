import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { OperatingSystem } from "os/os"
import { CreepName } from "prototype/creep"

ProcessDecoder.register("ConstructionSaboteurProcess", state => {
  return ConstructionSaboteurProcess.decode(state as ConstructionSaboteurProcessState)
})

type CreepSpecType = "minimum" | "heavy" | "decoy"
function creepBodyFor(specType: CreepSpecType): BodyPartConstant[] {
  switch (specType) {
  case "minimum":
    return [MOVE]
  case "heavy":
    return [MOVE, MOVE, MOVE, MOVE, MOVE]
  case "decoy":
    return [ATTACK, MOVE]
  }
}

type Options = {
  concurrentCreepCount: number
  maxCreepCount: number
  scoutSpec: CreepSpecType
}

interface ConstructionSaboteurProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly waypoints: RoomName[]
  readonly options: Options
  readonly creepNames: CreepName[]
}

export class ConstructionSaboteurProcess implements Process, Procedural {
  public readonly identifier: string
  public get launchTime(): number {
    return this.state.l
  }
  public get processId(): number {
    return this.state.i
  }
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    private readonly state: ConstructionSaboteurProcessState,
  ) {
    this.identifier = `${this.constructor.name}_${this.state.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): ConstructionSaboteurProcessState {
    return this.state
  }

  public static decode(state: ConstructionSaboteurProcessState): ConstructionSaboteurProcess {
    return new ConstructionSaboteurProcess(state)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], options: Options): ConstructionSaboteurProcess {
    const state: ConstructionSaboteurProcessState = {
      t: "ConstructionSaboteurProcess",
      l: Game.time,
      i: processId,
      roomName,
      targetRoomName,
      waypoints,
      options,
      creepNames: [],
    }
    return new ConstructionSaboteurProcess(state)
  }

  public processShortDescription(): string {
    const liveCreepCount = World.resourcePools.countCreeps(this.state.roomName, this.identifier, () => true)
    const creepDescription = `${liveCreepCount}/${this.state.options.concurrentCreepCount} (${this.state.creepNames.length}/${this.state.options.maxCreepCount} total)`
    return `${creepDescription} to ${roomLink(this.state.targetRoomName)}`
  }

  public runOnTick(): void {
    const creeps: Creep[] = this.state.creepNames.flatMap(creepName => {
      return Game.creeps[creepName]
    })

    if (creeps.length < this.state.options.concurrentCreepCount && this.state.creepNames.length < this.state.options.maxCreepCount) {
      World.resourcePools.addSpawnCreepRequest(this.state.roomName, {
        priority: CreepSpawnRequestPriority.Medium,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [CreepRole.Scout],
        body: creepBodyFor(),
        initialTask: null,
        taskIdentifier: this.identifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      this.state.roomName,
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
