import { MitsuyoshiBotProcessApi } from "./types"
import { AnyProcess, processDefaultIdentifier, ProcessDependencies, ProcessId } from "../../../process/process"
import { ApplicationProcess } from "../../../process/application_process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { SemanticVersion } from "shared/utility/semantic_version"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { SystemCalls } from "os_v5/system_calls/interface"
import type { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { BotTypes } from "os_v5/process/process_type_map"

// Driver Process
import { CreepDistributorProcess, CreepDistributorProcessId } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcess, CreepTaskStateManagementProcessId } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { V3BridgeSpawnRequestProcess, V3BridgeSpawnRequestProcessId } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"

// Child Process
import { EnergyHarvestRoomProcess, EnergyHarvestRoomProcessId } from "os_v5/processes/economy/energy_harvest_room/energy_harvest_room_process"


const commands = ["help", "expand"] as const
type Command = typeof commands[number]
const isCommand = (value: string): value is Command => (commands as Readonly<string[]>).includes(value)


const roomManagementTypes = ["normal", "energy_harvest"] as const
type RoomManagementType = typeof roomManagementTypes[number]
const isRoomManagementType = (value: string): value is RoomManagementType => (roomManagementTypes as Readonly<string[]>).includes(value)

type RoomInfoNormal = {
  readonly case: "normal"
}
type RoomInfoEnergyHarvest = {
  readonly case: "energy harvest"
  readonly processId: EnergyHarvestRoomProcessId
}
type RoomInfo = RoomInfoNormal | RoomInfoEnergyHarvest


const driverProcessTypes = [
  "CreepDistributorProcess",
  "CreepTaskStateManagementProcess",
  "V3BridgeSpawnRequestProcess",
] as const


ProcessDecoder.register("MitsuyoshiBotProcess", (processId: MitsuyoshiBotProcessId, state: MitsuyoshiBotProcessState) => MitsuyoshiBotProcess.decode(processId, state))

type MitsuyoshiBotProcessState = {
  readonly id: string
  readonly v: string
  readonly m: { [K: RoomName]: RoomInfo }
}
export type MitsuyoshiBotProcessId = ProcessId<void, string, MitsuyoshiBotProcessApi, MitsuyoshiBotProcessState, MitsuyoshiBotProcess>


export class MitsuyoshiBotProcess extends ApplicationProcess<void, string, MitsuyoshiBotProcessApi, MitsuyoshiBotProcessState, MitsuyoshiBotProcess> {
  public readonly applicationName = "MitsuyoshiBot"
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }
  public get processType(): BotTypes {
    return this.constructor.name as BotTypes
  }

  public readonly version = new SemanticVersion(10, 0, 7)

  private constructor(
    public readonly processId: MitsuyoshiBotProcessId,
    public readonly identifier: string,
    public readonly previousVersion: string,
    private readonly managingRoomInfo: { [K: RoomName]: RoomInfo },
  ) {
    super()
  }

  public encode(): MitsuyoshiBotProcessState {
    return {
      id: this.identifier,
      v: this.version.toString(),
      m: this.managingRoomInfo,
    }
  }

  public static decode(processId: MitsuyoshiBotProcessId, state: MitsuyoshiBotProcessState): MitsuyoshiBotProcess {
    return new MitsuyoshiBotProcess(processId, state.id, state.v, state.m)
  }

  public static create(processId: MitsuyoshiBotProcessId, identifier: string): MitsuyoshiBotProcess {
    return new MitsuyoshiBotProcess(processId, identifier, (new SemanticVersion(10, 0, 0)).toString(), {})
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    const descriptions: string[] = [
      `${this.version}`,
      `managing ${Object.keys(this.managingRoomInfo).length} rooms`,
    ]
    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }


  /** @throws */
  public didLaunch(): void {
    const addedProcesses: AnyProcess[] = []

    try {
      driverProcessTypes.forEach(driverProcessType => {
        if (SystemCalls.processManager.hasProcess(driverProcessType, processDefaultIdentifier) === true) {
          return
        }

        const driverProcess = SystemCalls.processManager.addProcess(processId => {
          switch (driverProcessType) {
          case "CreepDistributorProcess":
            return CreepDistributorProcess.create(processId as CreepDistributorProcessId)
          case "CreepTaskStateManagementProcess":
            return CreepTaskStateManagementProcess.create(processId as CreepTaskStateManagementProcessId)
          case "V3BridgeSpawnRequestProcess":
            return V3BridgeSpawnRequestProcess.create(processId as V3BridgeSpawnRequestProcessId)
          }
        })

        addedProcesses.push(driverProcess as AnyProcess)
      })
      return

    } catch (error) { // tear down
      addedProcesses.forEach(process => SystemCalls.processManager.killProcess(process))
      throw error
    }
  }


  // Message
  /** @throws */
  public didReceiveMessage(args: string[]): string {
    const argumentParser = new ArgumentParser(args)

    const command = argumentParser.typedString(0, "Command", isCommand, { choices: commands }).parse()
    argumentParser.dropFirstListArguments()

    switch (command) {
    case "help":
      return `Commands: [${commands}]`

    case "expand":
      return this.expand(argumentParser)
    }
  }

  /** @throws */
  private expand(argumentParser: ArgumentParser): string { // argumentParser の
    if (argumentParser.string(0).parseOptional() === "help") {
      return "expand {room name} {room management type} parent_room_name={room name}"
    }

    const roomName = argumentParser.roomName(0).parse({ my: false, allowClosedRoom: false })
    const roomManagementType = argumentParser.typedString(1, "RoomManagementType", isRoomManagementType, { choices: roomManagementTypes }).parse()
    const parentRoomName = argumentParser.roomName("parent_room_name").parse({ my: true, allowClosedRoom: false })

    if (this.managingRoomInfo[roomName] != null) {
      throw `${ConsoleUtility.roomLink(roomName)} is already running (${this.managingRoomInfo[roomName]?.case})`
    }

    switch (roomManagementType) {
    case "normal":
      throw `${roomManagementType} is not implemented yet`

    case "energy_harvest":
      return this.launchEnergyHarvestRoom(roomName, parentRoomName)

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = roomManagementType
      throw `Unknown room management type ${roomManagementType}`
    }
    }
  }

  // Run
  public run(): MitsuyoshiBotProcessApi {
    return {
      botInfo: {
        name: this.applicationName,
        identifier: this.identifier,
        version: this.version,
      },
    }
  }

  // Private
  /** @throws */
  private launchEnergyHarvestRoom(roomName: RoomName, parentRoomName: RoomName): string {
    const process = SystemCalls.processManager.addProcess((processId: EnergyHarvestRoomProcessId): EnergyHarvestRoomProcess => {
      return EnergyHarvestRoomProcess.create(
        processId,
        roomName,
        parentRoomName,
        {
          botSpecifier: {
            processType: this.processType,
            identifier: this.identifier,
          },
        },
      )
    })

    this.managingRoomInfo[roomName] = {
      case: "energy harvest",
      processId: process.processId
    }
    return `Launched ${process}`
  }
}
