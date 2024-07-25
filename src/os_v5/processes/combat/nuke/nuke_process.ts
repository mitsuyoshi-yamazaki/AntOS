import { Process, ProcessDependencies, ProcessId, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { Position } from "shared/utility/position_v2"
import { Timestamp } from "shared/utility/timestamp"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { Command, runCommands } from "os_v5/standard_io/command"
import { isMyRoom } from "shared/utility/room"
import { GameConstants } from "utility/constants"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

type NukerInfo = {
  readonly nukerId: Id<StructureNuker>
  readonly position: Position
}

type NukeTarget = {
  readonly roomName: RoomName
  launchTime: Timestamp
  readonly interval: Timestamp
  readonly nukers: NukerInfo[]
}

type NukeProcessState = {
  readonly n: NukeTarget[]
}

const { roomLink, coloredResourceType, shortenedNumber, ordinalNumber } = ConsoleUtility

ProcessDecoder.register("NukeProcess", (processId: NukeProcessId, state: NukeProcessState) => NukeProcess.decode(processId, state))

export type NukeProcessId = ProcessId<void, ProcessDefaultIdentifier, void, NukeProcessState, NukeProcess>


export class NukeProcess extends Process<void, ProcessDefaultIdentifier, void, NukeProcessState, NukeProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: NukeProcessId,
    readonly targets: NukeTarget[]
  ) {
    super()
  }

  public encode(): NukeProcessState {
    return {
      n: this.targets,
    }
  }

  public static decode(processId: NukeProcessId, state: NukeProcessState): NukeProcess {
    return new NukeProcess(processId, state.n)
  }

  public static create(processId: NukeProcessId): NukeProcess {
    return new NukeProcess(processId, [])
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return "TODO"
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  // Event Handler
  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.showNukersCommand,
      this.addTargetCommand,
    ])
  }

  public run(): void {
  }


  // ---- Command Runner ---- //
  private readonly addTargetCommand: Command = {
    command: "add_target",
    help: (): string => "add_target {target room name} delay={int} interval={int}, room_names={nuker room names}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const targetRoomName = argumentParser.roomName([0, "target room name"]).parse()

      const targetRange = GameConstants.structure.nuke.targetRange
      const myRooms = Array.from(Object.values(Game.rooms))
        .filter(isMyRoom)
        .filter(room => Game.map.getRoomLinearDistance(targetRoomName, room.name) <= targetRange)

      if (myRooms.length <= 0) {
        throw `No owned rooms around ${roomLink(targetRoomName)}`
      }

      const nukerRooms = argumentParser.list("room_names", "my_room").parse()
      const nukers = nukerRooms.map(room => {
        const nuker = room.find<StructureNuker>(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]
        if (nuker == null) {
          throw `No nuker in ${roomLink(room.name)}`
        }
        if (nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          throw `Nuker in ${roomLink(room.name)} lack of energy`
        }
        if (nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
          throw `Nuker in ${roomLink(room.name)} lack of ghodium`
        }
        return nuker
      })

      const targetFlags = Array.from(Object.values(Game.flags)).filter(flag => flag.pos.roomName === targetRoomName)
      if (nukers.length !== targetFlags.length) {
        throw `Target count mismatck: ${nukers.length} nukers != ${targetFlags.length} flags`
      }

      const delay = argumentParser.int("delay").parse({ min: 10 })
      const interval = argumentParser.int("interval").parse({ min: 0 })

      nukers.sort((lhs, rhs) => lhs.cooldown - rhs.cooldown)

      let launchTime = delay
      nukers.forEach((nuker, index) => {
        if (nuker.cooldown > launchTime) {
          throw `${ordinalNumber(index)} nuker will not be ready (cooldown ${nuker.cooldown} ticks)`
        }
        launchTime += interval
      })

      const nukerInfo: NukerInfo[] = []
      nukers.forEach((nuker, index) => {
        const flag = targetFlags[index]
        if (flag == null) {
          throw `No ${ordinalNumber(index)} flag`
        }

        nukerInfo.push({
          nukerId: nuker.id,
          position: { x: flag.pos.x, y: flag.pos.y } as Position,
        })
      })

      this.targets.push({
        roomName: targetRoomName,
        launchTime: Game.time + delay,
        interval,
        nukers: nukerInfo,
      })

      return `${roomLink(targetRoomName)} is added to target list`
    }
  }

  private readonly showNukersCommand: Command = {
    command: "show_nukers",
    help: (): string => "show_nukers {target room name}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const targetRoomName = argumentParser.roomName([0, "target room name"]).parse()

      const targetRange = GameConstants.structure.nuke.targetRange
      const myRooms = Array.from(Object.values(Game.rooms))
        .filter(isMyRoom)
        .filter(room => Game.map.getRoomLinearDistance(targetRoomName, room.name) <= targetRange)

      if (myRooms.length <= 0) {
        return `No owned rooms around ${roomLink(targetRoomName)}`
      }

      const roomInfo = myRooms.map((room): { order: number, description: string } => {
        if (room.controller.level < 8) {
          return {
            order: 10,
            description: `- ${roomLink(room.name)} RCL${room.controller.level}`,
          }
        }

        const nuker = room.find<StructureNuker>(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]
        if (nuker == null) {
          return {
            order: 5,
            description: `- ${roomLink(room.name)} no nuker`,
          }
        }

        const energyAmount = nuker.store.getUsedCapacity(RESOURCE_ENERGY)
        const energyCapacity = nuker.store.getCapacity(RESOURCE_ENERGY)
        const ghodiumAmount = nuker.store.getUsedCapacity(RESOURCE_GHODIUM)
        const ghodiumCapacity = nuker.store.getCapacity(RESOURCE_GHODIUM)

        let order = 0
        const descriptions: string[] = [
          `- ${roomLink(room.name)}`,
        ]

        if (energyAmount < energyCapacity || ghodiumAmount < ghodiumCapacity) {
          order += 1
          descriptions.push(`${resourceDescription(RESOURCE_ENERGY, energyAmount, energyCapacity)}, ${resourceDescription(RESOURCE_GHODIUM, ghodiumAmount, ghodiumCapacity)}`)
        }

        if (nuker.cooldown > 0) {
          order += 1
          descriptions.push(`cooldown: ${nuker.cooldown}`)
        }

        return {
          order,
          description: descriptions.join(", "),
        }
      })

      roomInfo.sort((lhs, rhs) => lhs.order - rhs.order)

      return `${roomInfo.length} rooms in range of ${roomLink(targetRoomName)}:\n${roomInfo.map(x => x.description).join("\n")}`
    }
  }
}

const resourceDescription = (resourceType: ResourceConstant, amount: number, capacity: number): string => {
  return `${coloredResourceType(resourceType)}: ${shortenedNumber(amount)}/${shortenedNumber(capacity)}`
}
