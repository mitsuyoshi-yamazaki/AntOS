import { Process, ProcessDefaultIdentifier, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { V3BridgeSpawnRequestProcessApi } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepDistributorProcessApi } from "../game_object_management/creep/creep_distributor_process"
import { AnyTrafficManagedCreep, CreepTrafficManagerProcessApi, TrafficManagedCreep } from "@private/os_v5/processes/game_object_management/creep/traffic/creep_traffic_manager_process"
import { CreepMoveOptions } from "@private/os_v5/processes/game_object_management/creep/traffic/traffic_managed"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ObjectParserCommand, runCommandsWith } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { describePosition } from "shared/utility/position_v2"
import { EmptySerializable } from "shared/utility/serializable_types"


type MyCreepMemory = {
  //
}
type MyCreep = TrafficManagedCreep<MyCreepMemory>

type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTrafficManagerProcessApi

type Command = ObjectParserCommand<Dependency, string>
type CreepCommand = ObjectParserCommand<[AnyTrafficManagedCreep, Dependency], string>

ProcessDecoder.register("ManualCreepOperatorProcess", (processId: ManualCreepOperatorProcessId) => ManualCreepOperatorProcess.decode(processId))

export type ManualCreepOperatorProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, void, EmptySerializable, ManualCreepOperatorProcess>


export class ManualCreepOperatorProcess extends Process<Dependency, ProcessDefaultIdentifier, void, EmptySerializable, ManualCreepOperatorProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTrafficManagerProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: ManualCreepOperatorProcessId,
  ) {
    super()

    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
  }

  public encode(): EmptySerializable {
    return {
    }
  }

  public static decode(processId: ManualCreepOperatorProcessId): ManualCreepOperatorProcess {
    return new ManualCreepOperatorProcess(processId)
  }

  public static create(processId: ManualCreepOperatorProcessId): ManualCreepOperatorProcess {
    return new ManualCreepOperatorProcess(processId)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(dependency: Dependency): string {
    const descriptions: string[] = [
    ]

    const creeps = dependency.getCreepsFor(this.processId)
    switch (creeps.length) {
    case 0:
    case 1:
      if (creeps[0] != null) {
        descriptions.push(`creep at ${describePosition(creeps[0].pos)} in ${ConsoleUtility.roomLink(creeps[0].room.name)}`)
      } else {
        descriptions.push("no creeps")
      }
      break
    default: {
      descriptions.push(`${creeps.length} creeps`)
    }
    }

    return descriptions.join(", ")
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser, dependency: Dependency): string {
    return runCommandsWith(argumentParser, dependency, [
      this.spawnCreepCommand,
      this.showCreepsCommand,
      this.creepCommand,
    ])
  }

  public run(dependency: Dependency): void {
    const creeps = dependency.getSpawnedCreepsFor(this.processId)
    dependency.registerTrafficManagedCreeps(creeps)
  }


  // ---- Command Runner ---- //
  private readonly spawnCreepCommand: Command = {
    command: "spawn",
    help: (): string => "spawn count={creep count} body={creep body} room_name={room name}",

    /** @throws */
    run: (argumentParser: ArgumentParser, dependency: Dependency): string => {
      const count = argumentParser.int("count").parse({ min: 1 })
      const body = argumentParser.creepBody("body").parse()
      const roomName = argumentParser.roomName("room_name").parse({my: true})

      for (let i = 0; i < count; i += 1) {
        const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, {})
        dependency.addSpawnRequestV2<MyCreepMemory>(this.processId, "default", body, roomName, {codename: this.codename, memory})
      }

      return `Reserved ${count} creep spawns`
    }
  }

  private readonly showCreepsCommand: Command = {
    command: "show",
    help: (): string => "show",

    /** @throws */
    run: (argumentParser: ArgumentParser, dependency: Dependency): string => {
      const creeps = dependency.getCreepsFor(this.processId) as MyCreep[] // run() 時点でregister済みのはず
      const creepDescription = (creep: MyCreep): string => {
        if (creep.ticksToLive == null) {
          return `- ${creep.name} spawning at ${describePosition(creep.pos)} in ${ConsoleUtility.roomLink(creep.room.name)}`
        }
        return `- ${creep.name} at ${describePosition(creep.pos)} in ${ConsoleUtility.roomLink(creep.room.name)}, moving: ${creep.trafficManager.moving?.case ?? "null"}`
      }

      const descriptions: string[] = [
        `${creeps.length} creeps:`,
        ...creeps.map(creepDescription),
      ]

      return descriptions.join("\n")
    }
  }

  // Creep
  private readonly creepCommand: Command = {
    command: "creep",
    help: (): string => "creep {command} {...args} -f",

    /** @throws */
    run: (argumentParser: ArgumentParser, dependency: Dependency): string => {
      const creep = argumentParser.v5SpawnedCreep([0, "creep name"]).parse()
      if (creep.memory.p !== this.processId) {
        if (argumentParser.hasOption("f") !== true) {
          throw `Creep ${creep.name} is not managed by ${this}, to ignore this warning add -f option`
        }
      }

      const trafficManagedCreep = creep as AnyTrafficManagedCreep
      if (trafficManagedCreep.trafficManager == null) {
        throw `Creep ${creep.name} is not traffic managed creep`
      }

      argumentParser.moveOffset(+1)

      return runCommandsWith<[AnyTrafficManagedCreep, Dependency], string>(argumentParser, [trafficManagedCreep, dependency], [
        this.moveToCommand,
        this.moveToRoomCommand,
        this.moveToShardCommand,
        this.clearMovingCommand,
      ])
    }
  }

  private readonly moveToCommand: CreepCommand = {
    command: "move_to",
    help: (): string => "move_to {x},{y} range?={int}",

    /** @throws */
    run: (argumentParser: ArgumentParser, [creep, dependency]: [AnyTrafficManagedCreep, Dependency]): string => {
      const destination = argumentParser.localPosition([0, "destination"]).parse()
      const range = argumentParser.int("range").parseOptional({min: 0})

      const options: CreepMoveOptions = {}
      if (range != null) {
        options.range = range
      }

      const result = creep.trafficManager.moveTo(destination, options)
      if (result.case !== "reserved") {
        throw `MoveTo failed ${result.case}`
      }
      dependency.registerManuallySetMoving(creep)
      return "ok"
    }
  }

  private readonly moveToRoomCommand: CreepCommand = {
    command: "move_to_room",
    help: (): string => "move_to_room {destination room name} waypoints={room names}",

    /** @throws */
    run: (argumentParser: ArgumentParser, [creep, dependency]: [AnyTrafficManagedCreep, Dependency]): string => {
      const destinationRoomName = argumentParser.roomName([0, "destination room name"]).parse()
      const waypoints = argumentParser.list("waypoints", "room_name").parse()

      const result = creep.trafficManager.moveToRoom(destinationRoomName, {waypoints})
      if (result !== "ok") {
        throw `MoveToRoom failed ${result}`
      }
      dependency.registerManuallySetMoving(creep)
      return "ok"
    }
  }

  private readonly moveToShardCommand: CreepCommand = {
    command: "move_to_shard",
    help: (): string => "move_to_shard {shard name} portal_room_name={room name} waypoints={room names}",

    /** @throws */
    run: (argumentParser: ArgumentParser, [creep, dependency]: [AnyTrafficManagedCreep, Dependency]): string => {
      const shardName = argumentParser.string([0, "shard name"]).parse()
      const portalRoomName = argumentParser.roomName("portal_room_name").parse()
      const waypoints = argumentParser.list("waypoints", "room_name").parse()

      const result = creep.trafficManager.moveToShard(shardName, portalRoomName, { waypoints })
      if (result !== "ok") {
        throw `MoveToRoom failed ${result}`
      }
      dependency.registerManuallySetMoving(creep)
      return "ok"
    }
  }

  private readonly clearMovingCommand: CreepCommand = {
    command: "clear",
    help: (): string => "clear",

    /** @throws */
    run: (argumentParser: ArgumentParser, [creep, dependency]: [AnyTrafficManagedCreep, Dependency]): string => {
      creep.trafficManager.clear()
      dependency.registerManuallySetMoving(creep)
      return "ok"
    }
  }
}
