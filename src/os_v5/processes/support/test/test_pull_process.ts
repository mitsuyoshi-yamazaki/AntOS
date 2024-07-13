import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { Command, runCommands } from "os_v5/standard_io/command"
import { RoomName } from "shared/utility/room_name_types"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepBody } from "utility/creep_body_v2"
import { V5Creep } from "os_v5/utility/game_object/creep"
import { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"
import { describePosition, Position } from "shared/utility/position_v2"
import { CreepName } from "prototype/creep"


type CreepRole = "puller" | "worker"
type MyCreepMemory = {
  readonly c: string    /// Codename
  readonly r: CreepRole /// Role
}
type MyCreep = V5Creep<MyCreepMemory>

type SpawnRequest = {
  readonly codename: string
  readonly body: CreepBody
  readonly role: CreepRole
}

type CreepOrderMove = {
  readonly case: "move"
  readonly position: Position
}
type CreepOrder = CreepOrderMove


type Dependency = CreepDistributorProcessApi
  & V3BridgeSpawnRequestProcessApi


type TestPullProcessState = {
  readonly r: RoomName    /// Room name
  readonly ci: number     /// Creep index
  readonly s: CreepName[] /// Squad creep names
  readonly o: CreepOrder | null /// Creep order
}

ProcessDecoder.register("TestPullProcess", (processId: TestPullProcessId, state: TestPullProcessState) => TestPullProcess.decode(processId, state))

export type TestPullProcessId = ProcessId<Dependency, RoomName, void, TestPullProcessState, TestPullProcess>


export class TestPullProcess extends Process<Dependency, RoomName, void, TestPullProcessState, TestPullProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string
  private spawnRequests: SpawnRequest[] = []

  private constructor(
    public readonly processId: TestPullProcessId,
    private readonly roomName: RoomName,
    private creepIndex: number,
    private squadCreepNames: CreepName[],
    private creepOrder: CreepOrder | null,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
  }

  public encode(): TestPullProcessState {
    return {
      r: this.roomName,
      ci: this.creepIndex,
      s: this.squadCreepNames,
      o: this.creepOrder,
    }
  }

  public static decode(processId: TestPullProcessId, state: TestPullProcessState): TestPullProcess {
    return new TestPullProcess(processId, state.r, state.ci, state.s, state.o)
  }

  public static create(processId: TestPullProcessId, roomName: RoomName): TestPullProcess {
    return new TestPullProcess(processId, roomName, 0, [], null)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return ConsoleUtility.roomLink(this.roomName)
  }

  public runtimeDescription(dependency: Dependency): string {
    const creeps = dependency.getCreepsFor(this.processId)
    const descriptions: string[] = [
      this.staticDescription(),
      `${creeps.length} creeps`,
    ]

    if (creeps.length <= 1 && creeps[0] != null) {
      descriptions.push(`at ${creeps[0].pos}`)
    }

    return descriptions.join(", ")
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.addCreepsCommand,
      this.addCreepOrderCommand,
    ])
  }

  public run(dependency: Dependency): void {
    const creeps: MyCreep[] = dependency.getCreepsFor(this.processId)
    if (creeps.length <= 0) {
      this.squadCreepNames = []
    }

    if (this.spawnRequests[0] != null) {
      const creepCodename = this.spawnRequests[0].codename
      const spawned = creeps.some(creep => creep.memory.c === creepCodename)
      if (spawned === true) {
        this.spawnRequests.shift()
      }
    }

    if (this.spawnRequests[0] != null) {
      this.spawn(dependency, this.spawnRequests[0])
    }

    creeps.forEach(creep => {
      if (this.squadCreepNames.includes(creep.name) === true) {
        return
      }
      switch (creep.memory.r) {
      case "puller":
        this.squadCreepNames.unshift(creep.name)
        break
      case "worker":
        this.squadCreepNames.push(creep.name)
        break
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = creep.memory.r
        break
      }
      }
    })

    const squadCreeps = this.squadCreepNames.flatMap((creepName): MyCreep[] => {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        return []
      }
      return [creep as unknown as MyCreep]
    })

    if (this.creepOrder != null) {
      this.runSquad(squadCreeps, this.creepOrder)
    }
  }


  // Private
  private runSquad(creeps: MyCreep[], order: CreepOrder): void {
    switch (order.case) {
    case "move":
      this.runMoveOrder(creeps, order)
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = order.case
      break
    }
    }
  }

  private runMoveOrder(creeps: MyCreep[], order: CreepOrderMove): void {
    const puller = creeps.shift()
    if (puller == null || puller.memory.r !== "puller") {
      return
    }

    const firstWorker = creeps[0]
    if (firstWorker == null) {
      return
    }

    if (puller.pos.getRangeTo(firstWorker.pos) > 1) {
      puller.moveTo(firstWorker)
      return
    }

    if (puller.pos.isEqualTo(order.position.x, order.position.y) === true) {
      return
    }

    puller.moveTo(order.position.x, order.position.y)
    const pullResult = puller.pull(firstWorker as unknown as Creep)
    const moveResult = firstWorker.move(puller as unknown as Creep)

    if (pullResult !== OK) {
      puller.say(`${pullResult}`)
    }
    if (moveResult !== OK) {
      firstWorker.say(`${moveResult}`)
    }

    // let isSnake = true
    // creeps.reduce((previous, current) => {
    //   if (previous.pos.getRangeTo(current.pos) !== 1) {
    //     isSnake = false
    //   }
    //   return current
    // })
  }

  private spawn(dependency: Dependency, request: SpawnRequest): void {
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { c: request.codename, r: request.role })
    dependency.addSpawnRequest<MyCreepMemory>(request.body, this.roomName, { codename: this.codename, memory })
  }

  private getCreepCodename(): string {
    const index = this.creepIndex
    this.creepIndex += 1
    return SystemCalls.uniqueId.generateFromInteger(index)
  }


  // ---- Command Runner ---- //
  private readonly addCreepsCommand: Command = {
    command: "add_creeps",
    help: (): string => "add_creeps {creep bodies}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      if (this.spawnRequests.length > 0) {
        throw `${this.spawnRequests.length} spawn requests exist`
      }

      const bodies = argumentParser.list([0, "creep bodies"], "creep_body").parse()
      this.spawnRequests = bodies.map((body): SpawnRequest => {
        const isPuller = body.bodyParts.includes(MOVE)

        return {
          codename: this.getCreepCodename(),
          body,
          role: isPuller === true ? "puller" : "worker",
        }
      })

      return `Added ${this.spawnRequests.map(x => x.role).join(", ")}`
    }
  }

  private readonly addCreepOrderCommand: Command = {
    command: "add_order",
    help: (): string => "add_order {order type} {...args}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      return runCommands(argumentParser, [
        this.parseMoveOrderCommand,
      ])
    }
  }

  private readonly parseMoveOrderCommand: Command = {
    command: "move",
    help: (): string => "move {x},{y}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const position = argumentParser.localPosition([0, "position"]).parse()

      this.creepOrder = {
        case: "move",
        position,
      }

      return `Set move order to ${describePosition(position)}`
    }
  }
}
