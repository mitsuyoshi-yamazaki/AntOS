import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepTrafficManagerProcessApi } from "os_v5/processes/game_object_management/creep/creep_traffic_management_process"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { Position } from "shared/utility/position_v2"
import { CreepName } from "prototype/creep"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { Command, ObjectParserCommand, runCommands, runObjectParserCommands } from "os_v5/standard_io/command"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepBody } from "utility/creep_body_v2"
import { CreepTaskStateManagementProcessApi, TaskDrivenCreep, TaskDrivenCreepMemory } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { V5CreepMemory } from "os_v5/utility/game_object/creep"


type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepTrafficManagerProcessApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi


type CreepOrderMoveTo = {
  readonly case: "move_to"
  readonly p: Position
  readonly r?: number
}
type CreepOrderAvoid = {
  readonly case: "avoid"
  readonly p: Position
  readonly r?: number
}
type CreepOrderFollow = {
  readonly case: "follow"
  readonly c: CreepName
  readonly r?: number
}
type CreepOrder = CreepOrderMoveTo | CreepOrderAvoid | CreepOrderFollow

type CreepSpawnRequest = {
  readonly codename: string
  readonly creepBody: CreepBody
  readonly order: CreepOrder
}


type CreepRole = ""
type CreepMemoryExtension = {
  codename?: string  /// Spawn確認用のcodename
  o?: CreepOrder
}
type MyCreep = TaskDrivenCreep<CreepRole, CreepMemoryExtension>
type MyCreepMemory = V5CreepMemory<TaskDrivenCreepMemory<CreepRole> & CreepMemoryExtension>


type TestTrafficManagementProcessState = {
  readonly r: RoomName
  readonly p: RoomName
}

ProcessDecoder.register("TestTrafficManagementProcess", (processId: TestTrafficManagementProcessId, state: TestTrafficManagementProcessState) => TestTrafficManagementProcess.decode(processId, state))

export type TestTrafficManagementProcessId = ProcessId<Dependency, RoomName, void, TestTrafficManagementProcessState, TestTrafficManagementProcess>


export class TestTrafficManagementProcess extends Process<Dependency, RoomName, void, TestTrafficManagementProcessState, TestTrafficManagementProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTrafficManagerProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }


  private readonly codename: string
  private creepSpawnRequests = new Map<string, CreepSpawnRequest>() /// キーは CreepMemoryExtension.codename


  private constructor(
    public readonly processId: TestTrafficManagementProcessId,
    public readonly roomName: RoomName,
    public readonly parentRoomName: RoomName,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("TestTrafficManagementProcess", parseInt(processId, 36))
  }

  public encode(): TestTrafficManagementProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName,
    }
  }

  public static decode(processId: TestTrafficManagementProcessId, state: TestTrafficManagementProcessState): TestTrafficManagementProcess {
    return new TestTrafficManagementProcess(processId, state.r, state.p)
  }

  public static create(processId: TestTrafficManagementProcessId, roomName: RoomName, parentRoomName: RoomName): TestTrafficManagementProcess {
    return new TestTrafficManagementProcess(processId, roomName, parentRoomName)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(dependency: Dependency): string {
    const descriptions: string[] = [
      this.staticDescription(),
      `${dependency.countCreepsFor(this.processId)} creeps`,
      `${this.creepSpawnRequests.size} spawn requests`
    ]

    return descriptions.join(", ")
  }

  /** @throws */
  didReceiveMessage?(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.addCreepCommand,
      this.clearSpawnRequestCommand,
      this.clearOrderCommand,
      this.setOrderCommand,
    ])
  }

  public run(dependency: Dependency): void {
    const creeps = dependency.getCreepsFor(this.processId)
    const creepsWithTask: MyCreep[] = dependency.registerTaskDrivenCreeps(creeps)
    this.runCreeps(creepsWithTask)

    this.requestSpawn(dependency, creepsWithTask)
  }


  // ---- Private ---- //
  private runCreeps(creeps: MyCreep[]): void {
    creeps.forEach(creep => {
      if (creep.task != null) {
        creep.say("🚶")
        return
      }

      creep.say("Hi")
    })
  }

  private requestSpawn(dependency: Dependency, creeps: MyCreep[]): void {
    if (this.creepSpawnRequests.size <= 0) {
      return
    }

    this.removeSpawnedCreepRequest(creeps)

    const request = Array.from(this.creepSpawnRequests.values())[0]
    if (request == null) {
      return
    }

    const memory: MyCreepMemory = dependency.createSpawnCreepMemoryFor(this.processId, {
      t: CreepTask.Tasks.MoveToRoom.create(this.roomName, []).encode(),
      r: "",
      codename: request.codename,
      o: request.order,
    })
    dependency.addSpawnRequest(request.creepBody, this.parentRoomName, {codename: this.codename, memory})
  }

  private removeSpawnedCreepRequest(creeps: MyCreep[]): void {
    creeps.forEach(creep => {
      const codename = creep.memory.codename
      if (codename == null) {
        return
      }
      delete creep.memory.codename
      this.creepSpawnRequests.delete(codename)
    })
  }


  // ---- Command Runner ---- //
  private readonly addCreepCommand: Command = {
    command: "add_creep",
    help: (): string => "add_creep {creep body} {order type} {...args}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const creepBody = argumentParser.creepBody([0, "creep body"]).parse({ requiredEnergyLimit: 500 })

      argumentParser.moveOffset(+1)
      const order = this.parseCreepOrder(argumentParser)

      const codename = SystemCalls.uniqueId.generateTickUniqueId()
      this.creepSpawnRequests.set(codename, {
        codename,
        order,
        creepBody,
      })

      return `Creep ${creepBody.stringRepresentation} is added to spawn queue with order ${order.case}`
    }
  }

  private readonly clearSpawnRequestCommand: Command = {
    command: "clear_spawn_request",
    help: (): string => "clear_spawn_request",

    /** @throws */
    run: (): string => {
      const requestCount = this.creepSpawnRequests.size
      this.creepSpawnRequests.clear()

      return `Cleared ${requestCount} requests`
    }
  }

  private readonly clearOrderCommand: Command = {
    command: "clear_order",
    help: (): string => "clear_order {creep name}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const creep = argumentParser.v5Creep([0, "creep name"]).parse({processId: this.processId}) as MyCreep
      const order = creep.memory.o
      if (order == null) {
        return `Creep ${creep.name} does not have order`
      }

      delete creep.memory.o

      return `Creep ${creep.name} order ${order.case} cleared`
    }
  }

  private readonly setOrderCommand: Command = {
    command: "set_order",
    help: (): string => "set_order {creep name} {order type} {...args}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const creep = argumentParser.v5Creep([0, "creep name"]).parse({ processId: this.processId }) as MyCreep

      argumentParser.moveOffset(+1)
      const order = this.parseCreepOrder(argumentParser)

      const currentOrder = creep.memory.o
      creep.memory.o = order

      if (currentOrder == null) {
        return `Creep ${creep.name} set order ${order.case}`
      } else {
        return `Creep ${creep.name} change order ${order.case} from ${currentOrder.case}`
      }
    }
  }


  // Parse MoveToOrder
  /** @throws */
  private parseCreepOrder(argumentParser: ArgumentParser): CreepOrder {
    return runObjectParserCommands<CreepOrder>(argumentParser, [
      this.parseMoveToOrderCommand,
      this.parseAvoidOrderCommand,
      this.parseFollowOrderCommand,
    ])
  }

  private readonly parseMoveToOrderCommand: ObjectParserCommand<CreepOrderMoveTo> = {
    command: "move_to",
    help: (): string => "move_to {position} {range}?",

    /** @throws */
    run: (argumentParser: ArgumentParser): CreepOrderMoveTo => {
      const position = argumentParser.localPosition([0, "position"]).parse()
      const range = argumentParser.int([1, "range"]).parseOptional({ min: 0, max: 3 })

      return {
        case: "move_to",
        p: position,
        r: range == null ? undefined : range
      }
    }
  }

  private readonly parseAvoidOrderCommand: ObjectParserCommand<CreepOrderAvoid> = {
    command: "avoid",
    help: (): string => "avoid {position} {range}?",

    /** @throws */
    run: (argumentParser: ArgumentParser): CreepOrderAvoid => {
      const position = argumentParser.localPosition([0, "position"]).parse()
      const range = argumentParser.int([1, "range"]).parseOptional({ min: 0, max: 3 })

      return {
        case: "avoid",
        p: position,
        r: range == null ? undefined : range
      }
    }
  }

  private readonly parseFollowOrderCommand: ObjectParserCommand<CreepOrderFollow> = {
    command: "follow",
    help: (): string => "follow {target creep name} {range}?",

    /** @throws */
    run: (argumentParser: ArgumentParser): CreepOrderFollow => {
      const creep = argumentParser.v5Creep([0, "target creep name"]).parse({processId: this.processId})
      const range = argumentParser.int([1, "range"]).parseOptional({ min: 0, max: 3 })

      return {
        case: "follow",
        c: creep.name,
        r: range == null ? undefined : range
      }
    }
  }
}
