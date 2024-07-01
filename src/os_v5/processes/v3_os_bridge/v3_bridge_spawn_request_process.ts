import { Process, processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { EmptySerializable, SerializableObject } from "os_v5/utility/types"
import { CreepBody } from "utility/creep_body_v2"
import { RoomName } from "shared/utility/room_name_types"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepName } from "prototype/creep"
import { V5CreepMemory } from "os_v5/utility/game_object/creep"
import { V3BridgeDriverProcessApi } from "./v3_bridge_driver_process"

// SpawnPoolのライフサイクル（v3 OSの実行）が終わった後に実行する必要がある


type SpawnRequest = {
  readonly body: CreepBody
  readonly roomName: RoomName
  readonly options?: {
    readonly codename?: string
    readonly uniqueCreepName?: CreepName
    readonly memory?: SerializableObject
  }
}
export type V3BridgeSpawnRequestProcessApi = {
  addSpawnRequest<M extends SerializableObject>(body: CreepBody, roomName: RoomName, options?: { codename?: string, uniqueCreepName?: CreepName, memory?: V5CreepMemory<M> }): void
}


type Dependency = V3BridgeDriverProcessApi

ProcessDecoder.register("V3BridgeSpawnRequestProcess", (processId: V3BridgeSpawnRequestProcessId) => V3BridgeSpawnRequestProcess.decode(processId))
export type V3BridgeSpawnRequestProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, V3BridgeSpawnRequestProcessApi, EmptySerializable, V3BridgeSpawnRequestProcess>


export class V3BridgeSpawnRequestProcess extends Process<Dependency, ProcessDefaultIdentifier, V3BridgeSpawnRequestProcessApi, EmptySerializable, V3BridgeSpawnRequestProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeDriverProcess", identifier: processDefaultIdentifier },
    ],
  }

  private spawnRequests: SpawnRequest[] = []

  private constructor(
    public readonly processId: V3BridgeSpawnRequestProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: V3BridgeSpawnRequestProcessId): V3BridgeSpawnRequestProcess {
    return new V3BridgeSpawnRequestProcess(processId)
  }

  public static create(processId: V3BridgeSpawnRequestProcessId): V3BridgeSpawnRequestProcess {
    return new V3BridgeSpawnRequestProcess(processId)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      `${this.spawnRequests.length} requests`,
    ]

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): V3BridgeSpawnRequestProcessApi {
    this.spawnRequests = []

    return {
      addSpawnRequest: <M extends SerializableObject>(body: CreepBody, roomName: RoomName, options?: { codename?: string, uniqueCreepName?: CreepName, memory?: V5CreepMemory<M> }): void => {
        this.spawnRequests.push({
          body,
          roomName,
          options,
        })
        // console.log(`${this} added spawn request ${body.stringRepresentation} in ${ConsoleUtility.roomLink(roomName)}`)
        // TODO: 内部的にSystemCalls.Loggerを呼び出すOnHeapLogger
      },
    }
  }

  public runAfterTick(dependency: Dependency): void {
    const skipRoomNames: RoomName[] = []

    this.spawnRequests.forEach(request => {
      if (skipRoomNames.includes(request.roomName) === true) {
        return
      }

      const idleSpawn = dependency.getIdleSpawnsFor(request.roomName)[0]
      if (idleSpawn == null) {
        skipRoomNames.push(request.roomName)
        return
      }

      const creepName = request.options?.uniqueCreepName != null ? request.options.uniqueCreepName : SystemCalls.uniqueName.generate(request.options?.codename)
      const options: SpawnOptions = {}
      if (request.options?.memory != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (options.memory as any) = request.options.memory
      }
      const result = idleSpawn.spawnCreep(request.body.bodyParts, creepName, options)
      if (result === OK) {
        skipRoomNames.push(request.roomName)
      }

      SystemCalls.logger.log(this, `${idleSpawn.name} in ${ConsoleUtility.roomLink(idleSpawn.room.name)}: ${result}`)
    })
  }
}
