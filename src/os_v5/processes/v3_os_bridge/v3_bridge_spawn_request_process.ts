import { Process, processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { EmptySerializable, SerializableObject } from "os_v5/utility/types"
import { CreepBody } from "utility/creep_body_v2"
import { RoomName } from "shared/utility/room_name_types"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepName } from "prototype/creep"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"

// SpawnPoolのライフサイクルはv3 OSのライフサイクル内で閉じているので、直接Spawn APIを呼び出す


ProcessDecoder.register("V3BridgeSpawnRequestProcess", (processId: V3BridgeSpawnRequestProcessId) => V3BridgeSpawnRequestProcess.decode(processId))


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
  addSpawnRequest(body: CreepBody, roomName: RoomName, options?: { codename?: string, uniqueCreepName?: CreepName, memory?: SerializableObject }): void
}
export type V3BridgeSpawnRequestProcessId = ProcessId<void, ProcessDefaultIdentifier, V3BridgeSpawnRequestProcessApi, EmptySerializable, V3BridgeSpawnRequestProcess>


export class V3BridgeSpawnRequestProcess extends Process<void, ProcessDefaultIdentifier, V3BridgeSpawnRequestProcessApi, EmptySerializable, V3BridgeSpawnRequestProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private spawnRequests: SpawnRequest[] = []
  private readonly forceSpawn = new Set<RoomName>()

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

  public getDependentData(): void { }

  public staticDescription(): string {
    const descriptions: string[] = [
      `${this.spawnRequests.length} requests`,
    ]
    if (this.forceSpawn.size > 0) {
      const forceSpawnRooms = Array.from(this.forceSpawn).map(roomName => ConsoleUtility.roomLink(roomName)).join(",")
      descriptions.push(`force spawn: ${forceSpawnRooms}`)
    }

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.forceSpawnCommand,
    ])
  }

  public run(): V3BridgeSpawnRequestProcessApi {
    this.spawnRequests = []

    return {
      addSpawnRequest: (body: CreepBody, roomName: RoomName, options?: { codename?: string, uniqueCreepName?: CreepName, memory?: SerializableObject }): void => {
        this.spawnRequests.push({
          body,
          roomName,
          options,
        })
        console.log(`${this} added spawn request ${body.stringRepresentation} in ${ConsoleUtility.roomLink(roomName)}`)
      },
    }
  }

  public runAfterTick(): void {
    const skipRoomNames: RoomName[] = []

    this.spawnRequests.forEach(request => {
      if (skipRoomNames.includes(request.roomName) === true) {
        return
      }
      const room = Game.rooms[request.roomName]
      if (room == null) {
        skipRoomNames.push(request.roomName)
        return
      }
      const spawns = room.find<StructureSpawn>(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })
      if (spawns.length <= 0) {
        skipRoomNames.push(request.roomName)
        return
      }
      if (this.forceSpawn.has(request.roomName) !== true) {
        const isSpawning = spawns.some(spawn => spawn.spawning != null)
        if (isSpawning === true) {
          skipRoomNames.push(request.roomName)
          return
        }
      }
      const spawn = spawns.find(spawn => spawn.spawning == null)
      if (spawn == null) {
        return
      }

      const creepName = request.options?.uniqueCreepName != null ? request.options.uniqueCreepName : SystemCalls.uniqueName.generate(request.options?.codename)
      const options: SpawnOptions = {}
      if (request.options?.memory != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (options.memory as any) = request.options.memory
      }
      const result = spawn.spawnCreep(request.body.bodyParts, creepName, options)
      this.forceSpawn.delete(request.roomName)

      console.log(`${this} ${spawn.name} in ${ConsoleUtility.roomLink(spawn.room.name)}: ${result}`)
    })
  }


  // ---- Command Runner ---- //
  private readonly forceSpawnCommand: Command = {
    command: "force_spawn",
    help: (): string => "force_spawn {room name}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const roomName = argumentParser.roomName([0, "room name"]).parse({ my: true, allowClosedRoom: false })
      this.forceSpawn.add(roomName)

      return `Set force spawn on ${ConsoleUtility.roomLink(roomName)}`
    }
  }
}
