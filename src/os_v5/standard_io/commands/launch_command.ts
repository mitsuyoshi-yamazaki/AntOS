// ---- Processes ---- //
// Bot
import { MitsuyoshiBotProcess, MitsuyoshiBotProcessId } from "../../processes/bot/mitsuyoshi_bot/mitsuyoshi_bot_process"

// Application
import { V3ResourceDistributorProcess, V3ResourceDistributorProcessId } from "../../processes/application/v3_resource_distributor_process"
import { } from "@private/os_v5/processes/application/problem_resolver/problem_resolver_process"

// Combat
import {} from "@private/os_v5/processes/combat/attack_room_manager_process"

// Economy
import { EnergyHarvestRoomProcess, EnergyHarvestRoomProcessId } from "../../processes/economy/energy_harvest_room/energy_harvest_room_process"
import {  } from "../../processes/economy/single_task_processes/dispose_resource_process"
import { StaticMonoCreepKeeperRoomProcess, StaticMonoCreepKeeperRoomProcessId } from "../../processes/economy/static_mono_creep_keeper_room/static_mono_creep_keeper_room_process"
import {  } from "@private/os_v5/processes/economy/generic_room_keeper/generic_room_keeper_process"
import { GenericRoomManagerProcess, GenericRoomManagerProcessId } from "@private/os_v5/processes/economy/generic_room_keeper/generic_room_manager_process"
import {  } from "@private/os_v5/processes/economy/room_planner/room_planner_process"
import { } from "@private/os_v5/processes/economy/room_planner/room_planner"

// Game Object Management
import { TerrainCacheProcess, TerrainCacheProcessId } from "../../processes/game_object_management/terrain_cache_process"
import { PathManagerProcess, PathManagerProcessId } from "../../processes/game_object_management/path_manager_process"
import { RoomMapProcess, RoomMapProcessId } from "../../processes/game_object_management/room_map_process"
import { RoomPathfindingProcess, RoomPathfindingProcessId } from "../../processes/game_object_management/room_pathfinding_process"
import { CreepTaskStateManagementProcess, CreepTaskStateManagementProcessId } from "../../processes/game_object_management/creep/creep_task_state_management_process"
import { CreepDistributorProcess, CreepDistributorProcessId } from "../../processes/game_object_management/creep/creep_distributor_process"
import { CreepTrafficManagerProcess, CreepTrafficManagerProcessId } from "@private/os_v5/processes/game_object_management/creep/creep_traffic_manager_process"
import { CreepPositionAssignerProcess, CreepPositionAssignerProcessId } from "@private/os_v5/processes/game_object_management/creep/creep_position_assigner_process"


// Support
import { /* 直接手動で生成することはない */ } from "../../processes/support/on_heap_continuous_task_process"
import { TestProcess, TestProcessId } from "../../processes/support/test/test_process"
import { TestPullProcess, TestPullProcessId } from "../../processes/support/test/test_pull_process"
import { TestTrafficManagerV2Process, TestTrafficManagerV2ProcessId } from "@private/os_v5/processes/support/test_traffic_manager/test_traffic_manager_v2_process"
import { TestTrafficManagerV3Process, TestTrafficManagerV3ProcessId } from "@private/os_v5/processes/support/test_traffic_manager/test_traffic_manager_v3_process"
import {  } from "@private/os_v5/processes/support/test_guard_room/test_guard_room_process"
import { TestHarvestRoomProcess, TestHarvestRoomProcessId } from "@private/os_v5/processes/support/test_harvest_room_process"

// v3 Bridge
import { V3BridgeDriverProcess, V3BridgeDriverProcessId } from "../../processes/v3_os_bridge/v3_bridge_driver_process"
import { V3BridgeSpawnRequestProcess, V3BridgeSpawnRequestProcessId } from "../../processes/v3_os_bridge/v3_bridge_spawn_request_process"


// ---- ---- //
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { AnyProcess, AnyProcessId, Process, ProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { SerializableObject } from "os_v5/utility/types"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"
import { isProcessType, ProcessTypes } from "os_v5/process/process_type_map"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { RoomName } from "shared/utility/room_name_types"
import { ProcessManagerError } from "os_v5/system_calls/process_manager/process_manager_error"


export const LaunchCommand: Command = {
  command: "launch",

  help(): string {
    return "launch {process type} ...{arguments}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const processType = argumentParser.typedString([0, "process type"], "ProcessTypes", isProcessType).parse()
    argumentParser.moveOffset(+1)

    try {
      return launchProcess(processType, argumentParser)
    } catch (error) {
      if (error instanceof ProcessManagerError) {
        switch (error.error.case) {
        case "already launched":
        case "lack of dependencies":
          return `${ConsoleUtility.colored("[Failed to launch]", "error")} ${error}`

        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _: never = error.error
          throw error
        }
        }
      }
      throw error
    }
  },
}


// ---- Process Launcher ---- //
type ProcessConstructor = <D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>) => P
type ConstructorMaker = (argumentParser: ArgumentParser, log: (output: string) => void) => ProcessConstructor

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

  const outputs: string[] = []
  const addOutput = (output: string): void => {
    outputs.push(output)
  }

  const constructor = constructorMaker(argumentParser, addOutput)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const process = ProcessManager.addProcess<any, any, any, any, AnyProcess>(constructor)

  outputs.unshift(`Launched ${process} ${process.staticDescription()}`)

  return outputs.join("\n")
}


// ---- Process Registration ---- //
// No arguments
((): void => {
  const processConstructors: [ProcessTypes, (processId: AnyProcessId) => AnyProcess][] = [
    ["V3BridgeSpawnRequestProcess", processId => V3BridgeSpawnRequestProcess.create(processId as V3BridgeSpawnRequestProcessId)],
    ["V3BridgeDriverProcess", processId => V3BridgeDriverProcess.create(processId as V3BridgeDriverProcessId)],
    ["RoomPathfindingProcess", processId => RoomPathfindingProcess.create(processId as RoomPathfindingProcessId)],
    ["CreepTaskStateManagementProcess", processId => CreepTaskStateManagementProcess.create(processId as CreepTaskStateManagementProcessId)],
    ["CreepDistributorProcess", processId => CreepDistributorProcess.create(processId as CreepDistributorProcessId)],
    ["CreepTrafficManagerProcess", processId => CreepTrafficManagerProcess.create(processId as CreepTrafficManagerProcessId)],
    ["CreepPositionAssignerProcess", processId => CreepPositionAssignerProcess.create(processId as CreepPositionAssignerProcessId)],
    ["V3ResourceDistributorProcess", processId => V3ResourceDistributorProcess.create(processId as V3ResourceDistributorProcessId)],
    ["GenericRoomManagerProcess", processId => GenericRoomManagerProcess.create(processId as GenericRoomManagerProcessId)],
    ["TerrainCacheProcess", processId => TerrainCacheProcess.create(processId as TerrainCacheProcessId)],
    ["PathManagerProcess", processId => PathManagerProcess.create(processId as PathManagerProcessId)],
    ["RoomMapProcess", processId => RoomMapProcess.create(processId as RoomMapProcessId)],
  ]

  processConstructors.forEach(([processType, constructor]) => {
    registerProcess(processType, () => constructor as ProcessConstructor)
  })
})()

// Only room name
;
((): void => {
  const processConstructors: [ProcessTypes, boolean, (roomName: RoomName) => (processId: AnyProcessId) => AnyProcess][] = [
    ["TestPullProcess", true, roomName => processId => TestPullProcess.create(processId as TestPullProcessId, roomName)],
    ["TestHarvestRoomProcess", true, roomName => processId => TestHarvestRoomProcess.create(processId as TestHarvestRoomProcessId, roomName)],
    ["TestTrafficManagerV3Process", true, roomName => processId => TestTrafficManagerV3Process.create(processId as TestTrafficManagerV3ProcessId, roomName)],
  ]

  processConstructors.forEach(([processType, my, constructor]) => {
    registerProcess(processType, argumentParser => constructor(argumentParser.roomName([0, "room name"]).parse({ my })) as ProcessConstructor)
  })
})()

registerProcess("TestProcess", (argumentParser) => {
  const identifier = argumentParser.string([0, "process identifier"]).parse()

  return ((processId: TestProcessId): TestProcess => {
    return TestProcess.create(processId, identifier)
  }) as ProcessConstructor
})

registerProcess("EnergyHarvestRoomProcess", (argumentParser) => {
  const roomName = argumentParser.roomName("room_name").parse({my: false, allowClosedRoom: false})
  const parentRoomName = argumentParser.roomName("parent_room_name").parse({ my: true, allowClosedRoom: false })

  return ((processId: EnergyHarvestRoomProcessId): EnergyHarvestRoomProcess => {
    return EnergyHarvestRoomProcess.create(processId, roomName, parentRoomName)
  }) as ProcessConstructor
})

registerProcess("MitsuyoshiBotProcess", (argumentParser) => {
  const identifier = argumentParser.string([0, "process identifier"]).parse()

  return ((processId: MitsuyoshiBotProcessId): MitsuyoshiBotProcess => {
    return MitsuyoshiBotProcess.create(processId, identifier)
  }) as ProcessConstructor
})

registerProcess("TestTrafficManagerV2Process", (argumentParser) => {
  const roomName = argumentParser.roomName("room_name").parse({ allowClosedRoom: false })
  const parentRoomName = argumentParser.roomName("parent_room_name").parse({ my: true, allowClosedRoom: false })

  return ((processId: TestTrafficManagerV2ProcessId): TestTrafficManagerV2Process => {
    return TestTrafficManagerV2Process.create(processId, roomName, parentRoomName)
  }) as ProcessConstructor
})

registerProcess("StaticMonoCreepKeeperRoomProcess", (argumentParser, log) => {
  const roomName = argumentParser.roomName("room_name").parse({ allowClosedRoom: false })

  const room = Game.rooms[roomName]
  const sourceId = ((): Id<Source> => {
    if (room == null) {
      return argumentParser.roomObjectId("source_id").parse() as Id<Source>
    }

    if (room.controller == null) {
      throw `${ConsoleUtility.roomLink(roomName)} doesn't have a controller`
    }

    const source = room.controller.pos.findClosestByRange(FIND_SOURCES)
    if (source == null) {
      throw `No source in ${ConsoleUtility.roomLink(roomName)}`
    }

    const range = source.pos.getRangeTo(room.controller.pos)
    if (range > 4) {
      throw `Source at ${source.pos} and controller at ${room.controller.pos} are too far`
    }

    log(`Set source at ${source.pos} (range: ${range})`)
    return source.id
  })()

  const parentRoomName = argumentParser.roomName("parent_room_name").parse({ my: true, allowClosedRoom: false })

  return ((processId: StaticMonoCreepKeeperRoomProcessId): StaticMonoCreepKeeperRoomProcess => {
    return StaticMonoCreepKeeperRoomProcess.create(processId, roomName, parentRoomName, sourceId)
  }) as ProcessConstructor
})
