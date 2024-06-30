// ---- Processes ---- //
// Bot
import { MitsuyoshiBotProcess, MitsuyoshiBotProcessId } from "../../processes/bot/mitsuyoshi_bot/mitsuyoshi_bot_process"

// Application
import {} from "../../processes/application/v3_resource_distributor_process"

// Combat
import {} from "@private/os_v5/processes/combat/attack_room_manager_process"

// Economy
import { EnergyHarvestRoomProcess, EnergyHarvestRoomProcessId } from "../../processes/economy/energy_harvest_room/energy_harvest_room_process"
import {  } from "../../processes/economy/single_task_processes/trash_resource_process"

// Game Object Management
import { RoomPathfindingProcess, RoomPathfindingProcessId } from "../../processes/game_object_management/room_pathfinding_process"
import { CreepTaskStateManagementProcess, CreepTaskStateManagementProcessId } from "../../processes/game_object_management/creep/creep_task_state_management_process"
import { CreepDistributorProcess, CreepDistributorProcessId } from "../../processes/game_object_management/creep/creep_distributor_process"
import { CreepTrafficManagerProcess, CreepTrafficManagerProcessId } from "@private/os_v5/processes/game_object_management/creep/creep_traffic_manager_process"


// Temporary
import { TestProcess, TestProcessId } from "../../processes/support/test/test_process"
import { TestTrafficManagerProcess, TestTrafficManagerProcessId } from "../../processes/support/test/test_traffic_manager_process"

// v3 Bridge
import { V3BridgeSpawnRequestProcess, V3BridgeSpawnRequestProcessId } from "../../processes/v3_os_bridge/v3_bridge_spawn_request_process"


// ---- ---- //
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { AnyProcess, Process, ProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { SerializableObject } from "os_v5/utility/types"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"
import { isProcessType, ProcessTypes } from "os_v5/process/process_type_map"


export const LaunchCommand: Command = {
  command: "launch",

  help(): string {
    return "> launch {process type} ...{arguments}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const processType = argumentParser.typedString([0, "process type"], "ProcessTypes", isProcessType).parse()
    argumentParser.moveOffset(+1)

    return launchProcess(processType, argumentParser)
  },
}


// Process Launcher
type ProcessConstructor = <D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>) => P
type ConstructorMaker = (argumentParser: ArgumentParser) => ProcessConstructor

const constructorMakers = new Map<ProcessTypes, ConstructorMaker>()

const registerProcess = (processType: ProcessTypes, launcher: ConstructorMaker): void => {
  try {
    if (constructorMakers.has(processType) === true) {
      PrimitiveLogger.programError(`Process ${processType} is registered multiple times`)
      return
    }
    constructorMakers.set(processType, launcher)
  } catch (error) {
    PrimitiveLogger.fatal(`An exception raised while process ${processType} is being registered: ${error}`)
  }
}

/** @throws */
const launchProcess = (processType: ProcessTypes, argumentParser: ArgumentParser): string => {
  const constructorMaker = constructorMakers.get(processType)
  if (constructorMaker == null) {
    throw `Unregistered process type ${processType}`
  }

  const constructor = constructorMaker(argumentParser)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const process = ProcessManager.addProcess<any, any, any, any, AnyProcess>(constructor)

  return `Launched ${process} ${process.staticDescription()}`
}


// Process Registration
registerProcess("TestProcess", (argumentParser) => {
  const identifier = argumentParser.string([0, "process identifier"]).parse()

  return ((processId: TestProcessId): TestProcess => {
    return TestProcess.create(processId, identifier)
  }) as ProcessConstructor
})

registerProcess("V3BridgeSpawnRequestProcess", () => {
  return ((processId: V3BridgeSpawnRequestProcessId): V3BridgeSpawnRequestProcess => {
    return V3BridgeSpawnRequestProcess.create(processId)
  }) as ProcessConstructor
})

registerProcess("RoomPathfindingProcess", () => {
  return ((processId: RoomPathfindingProcessId): RoomPathfindingProcess => {
    return RoomPathfindingProcess.create(processId)
  }) as ProcessConstructor
})

registerProcess("EnergyHarvestRoomProcess", (argumentParser) => {
  const roomName = argumentParser.roomName("room_name").parse({my: false, allowClosedRoom: false})
  const parentRoomName = argumentParser.roomName("parent_room_name").parse({ my: true, allowClosedRoom: false })

  return ((processId: EnergyHarvestRoomProcessId): EnergyHarvestRoomProcess => {
    return EnergyHarvestRoomProcess.create(processId, roomName, parentRoomName)
  }) as ProcessConstructor
})

registerProcess("CreepTaskStateManagementProcess", () => {
  return ((processId: CreepTaskStateManagementProcessId): CreepTaskStateManagementProcess => {
    return CreepTaskStateManagementProcess.create(processId)
  }) as ProcessConstructor
})

registerProcess("CreepDistributorProcess", () => {
  return ((processId: CreepDistributorProcessId): CreepDistributorProcess => {
    return CreepDistributorProcess.create(processId)
  }) as ProcessConstructor
})

registerProcess("MitsuyoshiBotProcess", (argumentParser) => {
  const identifier = argumentParser.string([0, "process identifier"]).parse()

  return ((processId: MitsuyoshiBotProcessId): MitsuyoshiBotProcess => {
    return MitsuyoshiBotProcess.create(processId, identifier)
  }) as ProcessConstructor
})

registerProcess("CreepTrafficManagerProcess", () => {
  return ((processId: CreepTrafficManagerProcessId): CreepTrafficManagerProcess => {
    return CreepTrafficManagerProcess.create(processId)
  }) as ProcessConstructor
})

registerProcess("TestTrafficManagerProcess", (argumentParser) => {
  const roomName = argumentParser.roomName("room_name").parse({ my: false, allowClosedRoom: false })
  const parentRoomName = argumentParser.roomName("parent_room_name").parse({ my: true, allowClosedRoom: false })

  return ((processId: TestTrafficManagerProcessId): TestTrafficManagerProcess => {
    return TestTrafficManagerProcess.create(processId, roomName, parentRoomName)
  }) as ProcessConstructor
})
