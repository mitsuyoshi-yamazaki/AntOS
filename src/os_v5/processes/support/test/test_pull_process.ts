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
import { Position } from "shared/utility/position_v2"
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
    private readonly squadCreepNames: CreepName[],
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
    }
  }

  public static decode(processId: TestPullProcessId, state: TestPullProcessState): TestPullProcess {
    return new TestPullProcess(processId, state.r, state.ci, state.s)
  }

  public static create(processId: TestPullProcessId, roomName: RoomName): TestPullProcess {
    return new TestPullProcess(processId, roomName, 0, [])
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
    ])
  }

  public run(dependency: Dependency): void {
    const creeps: MyCreep[] = dependency.getCreepsFor(this.processId)
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


  }


  // Private

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
}
