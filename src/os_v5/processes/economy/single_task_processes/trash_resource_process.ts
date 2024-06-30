import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcessApi, TaskDrivenCreep, TaskDrivenCreepMemory } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { MyRoom } from "shared/utility/room"
import { DepositConstant, MineralConstant } from "shared/utility/resource"


type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi


type CreepRoles = ""
// eslint-disable-next-line @typescript-eslint/ban-types
type CreepMemoryExtension = {}
type MyCreep = TaskDrivenCreep<CreepRoles, CreepMemoryExtension>
type MyCreepMemory = TaskDrivenCreepMemory<CreepRoles> & CreepMemoryExtension


const defaultTrashableResources: ResourceConstant[] = [
  ...DepositConstant,
  ...MineralConstant,
]
type TrashResourceProcessState = {
  readonly r: RoomName
  readonly p?: RoomName
  readonly tr?: ResourceConstant[] /// undefined なら defaultTrashableResources
}

ProcessDecoder.register("TrashResourceProcess", (processId: TrashResourceProcessId, state: TrashResourceProcessState) => TrashResourceProcess.decode(processId, state))

export type TrashResourceProcessId = ProcessId<Dependency, RoomName, void, TrashResourceProcessState, TrashResourceProcess>


export class TrashResourceProcess extends Process<Dependency, RoomName, void, TrashResourceProcessState, TrashResourceProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }


  private readonly codename: string


  private constructor(
    public readonly processId: TrashResourceProcessId,
    public readonly roomName: RoomName,
    public readonly parentRoomName: RoomName,
    public readonly resourcesToTrash: ResourceConstant[] | undefined,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("TrashResourceProcess", parseInt(processId, 36))
  }

  public encode(): TrashResourceProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName === this.roomName ? undefined : this.parentRoomName,
      tr: this.resourcesToTrash,
    }
  }

  public static decode(processId: TrashResourceProcessId, state: TrashResourceProcessState): TrashResourceProcess {
    return new TrashResourceProcess(processId, state.r, state.p ?? state.r, state.tr)
  }

  public static create(processId: TrashResourceProcessId, room: MyRoom, parentRoom: MyRoom): TrashResourceProcess {
    return new TrashResourceProcess(processId, room.name, parentRoom.name, undefined)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }
  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): void {
    const creeps = dependency.getCreepsFor(this.processId)
    const creepsWithTask: MyCreep[] = dependency.registerTaskDrivenCreeps(creeps)

    if (creepsWithTask.length <= 0) {
      this.spawnCreep(dependency)
    }

    creepsWithTask.forEach(creep => {
      if (creep.task == null) {
        creep.task = this.creepTaskFor(creep)
      }
    })
  }

  // Private
  private spawnCreep(dependency: Dependency): void {
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { t: null, r: "" })
    dependency.addSpawnRequest(CreepBody.createWithBodyParts([CARRY, MOVE]), this.parentRoomName, { codename: this.codename, memory })
  }

  private creepTaskFor(creep: MyCreep): CreepTask.AnyTask | null {
    return null
  }
}
