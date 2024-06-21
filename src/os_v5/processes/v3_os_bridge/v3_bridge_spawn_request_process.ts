import { Process, ProcessDependencies, ProcessId } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { EmptySerializable, SerializableObject } from "os_v5/utility/types"
import { CreepBody } from "utility/creep_body_v2"
import { RoomName } from "shared/utility/room_name_types"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepName } from "prototype/creep"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"

// SpawnPoolのライフサイクルはv3 OSのライフサイクル内で閉じているので、直接Spawn APIを呼び出す


const commands = ["help", "force_spawn"] as const
type Command = typeof commands[number]
const isCommand = (command: string): command is Command => (commands as Readonly<string[]>).includes(command)


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
export type V3BridgeSpawnRequestProcessId = ProcessId<void, "V3SpawnRequest", V3BridgeSpawnRequestProcessApi, EmptySerializable, V3BridgeSpawnRequestProcess>


export class V3BridgeSpawnRequestProcess extends Process<void, "V3SpawnRequest", V3BridgeSpawnRequestProcessApi, EmptySerializable, V3BridgeSpawnRequestProcess> {
  public readonly identifier = "V3SpawnRequest"
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
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(args: string[]): string {
    const argumentParser = new ArgumentParser(args)

    const command = argumentParser.typedString(0, "Command", isCommand, {choices: commands}).parse()
    switch (command) {
    case "help":
      return `Commands: [${commands}]`

    case "force_spawn":
      return this.setForceSpawn(argumentParser)
    }
  }

  /** @throws */
  private setForceSpawn(argumentParser: ArgumentParser): string {
    const roomName = argumentParser.roomName(0).parse({ my: true, allowClosedRoom: false })
    this.forceSpawn.add(roomName)

    return `Set force spawn on ${ConsoleUtility.roomLink(roomName)}`
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
      const spawn = spawns[spawns.length - 1] as StructureSpawn
      const creepName = request.options?.uniqueCreepName != null ? request.options.uniqueCreepName : SystemCalls.uniqueName.generate(request.options?.codename)
      const options: SpawnOptions = {}
      if (request.options?.memory != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (options.memory as any) = request.options.memory
      }
      const result = spawn.spawnCreep(request.body.bodyParts, creepName, options)

      if (result === OK) {
        this.forceSpawn.delete(request.roomName)
      }

      console.log(`${this.processType}[${this.identifier}] ${spawn.name} in ${ConsoleUtility.roomLink(spawn.room.name)}: ${result}`)
    })
  }
}
