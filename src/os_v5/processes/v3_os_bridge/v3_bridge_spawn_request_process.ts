import { AnyProcessId, Process, processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { SerializableObject } from "shared/utility/serializable_types"
import { CreepBody, CreepBodyStringRepresentation } from "utility/creep_body_v2"
import { RoomName } from "shared/utility/room_name_types"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepName } from "prototype/creep"
import { V5CreepMemory } from "os_v5/utility/game_object/creep"
import { V3BridgeDriverProcessApi } from "./v3_bridge_driver_process"
import { Notification } from "os_v5/system_calls/depended_system_calls/notification_manager_types"

// SpawnPoolのライフサイクル（v3 OSの実行）が終わった後に実行する必要がある

// TODO: リクエストを補完して、Spawnしたら通知する

type SpawnRequest = {
  readonly body: CreepBody
  readonly roomName: RoomName
  readonly options?: {
    readonly codename?: string
    readonly uniqueCreepName?: CreepName
    readonly memory?: SerializableObject
  }
}
type StoredSpawnRequest = {
  readonly processId: AnyProcessId
  readonly identifier: string
  readonly body: CreepBodyStringRepresentation
  readonly roomName: RoomName
  readonly bodyCost: number
  readonly options?: {
    readonly codename?: string
    readonly uniqueCreepName?: CreepName
    readonly memory?: SerializableObject
  }
}

export type V3BridgeSpawnRequestProcessApi = {
  addSpawnRequest<M extends SerializableObject>(body: CreepBody, roomName: RoomName, options?: { codename?: string, uniqueCreepName?: CreepName, memory?: V5CreepMemory<M> }): void
  addSpawnRequestV2<M extends SerializableObject>(processId: AnyProcessId, identifier: string, body: CreepBody, roomName: RoomName, options?: { codename?: string, uniqueCreepName?: CreepName, memory?: V5CreepMemory<M> }): void
}

export const v3BridgeSpawnRequestDidSpawnNotification = "v3_spawn_spawned"
export const v3BridgeSpawnRequestDidFailNotification = "v3_spawn_failed"

export type V3BridgeSpawnRequestDidSpawnNotification = Notification & {
  readonly eventName: "v3_spawn_spawned"
  readonly creepName: CreepName
  readonly processId: AnyProcessId
  readonly identifier: string
}
export type V3BridgeSpawnRequestDidFailNotification = Notification & {
  readonly eventName: "v3_spawn_failed"
  readonly processId: AnyProcessId
  readonly identifier: string
  readonly errorCode: Exclude<ScreepsReturnCode, OK>
}
export type V3BridgeSpawnRequestNotification = V3BridgeSpawnRequestDidSpawnNotification | V3BridgeSpawnRequestDidFailNotification


type Dependency = V3BridgeDriverProcessApi

type V3BridgeSpawnRequestProcessState = {
  readonly r: StoredSpawnRequest[]  /// Spawn requests
}


ProcessDecoder.register("V3BridgeSpawnRequestProcess", (processId: V3BridgeSpawnRequestProcessId, state: V3BridgeSpawnRequestProcessState) => V3BridgeSpawnRequestProcess.decode(processId, state))
export type V3BridgeSpawnRequestProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, V3BridgeSpawnRequestProcessApi, V3BridgeSpawnRequestProcessState, V3BridgeSpawnRequestProcess>


export class V3BridgeSpawnRequestProcess extends Process<Dependency, ProcessDefaultIdentifier, V3BridgeSpawnRequestProcessApi, V3BridgeSpawnRequestProcessState, V3BridgeSpawnRequestProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeDriverProcess", identifier: processDefaultIdentifier },
    ],
  }

  private spawnRequests: SpawnRequest[] = []

  private constructor(
    public readonly processId: V3BridgeSpawnRequestProcessId,
    private readonly storedSpawnRequests: StoredSpawnRequest[],
  ) {
    super()
  }

  public encode(): V3BridgeSpawnRequestProcessState {
    return {
      r: this.storedSpawnRequests,
    }
  }

  public static decode(processId: V3BridgeSpawnRequestProcessId, state: V3BridgeSpawnRequestProcessState): V3BridgeSpawnRequestProcess {
    return new V3BridgeSpawnRequestProcess(processId, state.r)
  }

  public static create(processId: V3BridgeSpawnRequestProcessId): V3BridgeSpawnRequestProcess {
    return new V3BridgeSpawnRequestProcess(processId, [])
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
        // SystemCalls.logger.log(this, `Added spawn request ${body.stringRepresentation} in ${ConsoleUtility.roomLink(roomName)}`)
        // TODO: 内部的にSystemCalls.Loggerを呼び出すOnHeapLogger
      },

      addSpawnRequestV2: <M extends SerializableObject>(processId: AnyProcessId, identifier: string, body: CreepBody, roomName: RoomName, options?: { codename?: string, uniqueCreepName?: CreepName, memory?: V5CreepMemory<M> }): void => {
        this.storedSpawnRequests.push({
          processId,
          identifier,
          body: body.stringRepresentation,
          bodyCost: body.energyCost,
          roomName,
          options,
        })
      },
    }
  }

  public runAfterTick(dependency: Dependency): void {
    const skipRoomNames: RoomName[] = []

    this.spawnRequests.forEach(request => {
      if (skipRoomNames.includes(request.roomName) === true) {
        return
      }

      const spawnInfo = dependency.getIdleSpawnsFor(request.roomName)
      if (spawnInfo == null) {
        skipRoomNames.push(request.roomName)
        return
      }

      const idleSpawn = spawnInfo.idleSpawns[0]
      if (idleSpawn == null) {
        skipRoomNames.push(request.roomName)
        return
      }

      if (request.body.energyCost > spawnInfo.remainingEnergy) {
        return
      }

      const creepName = request.options?.uniqueCreepName != null ? request.options.uniqueCreepName : SystemCalls.uniqueName.generate_unique_creep_name(request.options?.codename)
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

    const deleteIndices: number[] = []
    this.storedSpawnRequests.forEach((request, index) => {
      if (skipRoomNames.includes(request.roomName) === true) {
        return
      }

      const spawnInfo = dependency.getIdleSpawnsFor(request.roomName)
      if (spawnInfo == null) {
        skipRoomNames.push(request.roomName)
        return
      }

      const idleSpawn = spawnInfo.idleSpawns[0]
      if (idleSpawn == null) {
        skipRoomNames.push(request.roomName)
        return
      }

      if (request.bodyCost > spawnInfo.remainingEnergy) {
        return
      }

      const creepName = request.options?.uniqueCreepName != null ? request.options.uniqueCreepName : SystemCalls.uniqueName.generate_unique_creep_name(request.options?.codename)
      const options: SpawnOptions = {}
      if (request.options?.memory != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (options.memory as any) = request.options.memory
      }
      const result = idleSpawn.spawnCreep(CreepBody.createFromStringRepresentation(request.body).bodyParts, creepName, options)
      if (result === OK) {
        skipRoomNames.push(request.roomName)
        this.sendNotification({
          eventName: "v3_spawn_spawned",
          processId: request.processId,
          identifier: request.identifier,
          creepName,
        })
      } else {
        this.sendNotification({
          eventName: "v3_spawn_failed",
          processId: request.processId,
          identifier: request.identifier,
          errorCode: result,
        })
      }

      deleteIndices.push(index)
      SystemCalls.logger.log(this, `${idleSpawn.name} in ${ConsoleUtility.roomLink(idleSpawn.room.name)}: ${result}`)
    })

    deleteIndices.reverse()
    deleteIndices.forEach(index => this.storedSpawnRequests.splice(index, 1))
  }

  private sendNotification(notification: V3BridgeSpawnRequestNotification): void {
    SystemCalls.notificationManager.send(notification)
  }
}
