
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { ProcessDecoder } from "process/process_decoder"
import { RoomResources } from "room_resource/room_resources"
import { CreepName } from "prototype/creep"
import { MessageObserver } from "os/infrastructure/message_observer"
import { decodeRoomPosition, describePosition, Position } from "prototype/room_position"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { travelTo, TravelToOptions } from "prototype/travel_to"

ProcessDecoder.register("Season4TravelerTestProcess", state => {
  return Season4TravelerTestProcess.decode(state as Season4TravelerTestProcessState)
})

export interface Season4TravelerTestProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly creepName: CreepName | null
  readonly position: Position | null
  readonly cachePath: boolean
}

export class Season4TravelerTestProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly identifier: string
  private readonly codename = "traveler_test"

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private creepName: CreepName | null,
    private position: Position | null,
    private cachePath: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): Season4TravelerTestProcessState {
    return {
      t: "Season4TravelerTestProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      creepName: this.creepName,
      position: this.position,
      cachePath: this.cachePath,
    }
  }

  public static decode(state: Season4TravelerTestProcessState): Season4TravelerTestProcess | null {
    return new Season4TravelerTestProcess(state.l, state.i, state.roomName, state.creepName, state.position, state.cachePath)
  }

  public static create(processId: ProcessId, roomName: RoomName): Season4TravelerTestProcess {
    return new Season4TravelerTestProcess(Game.time, processId, roomName, null, null, false)
  }

  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "set", "set_cachepath"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "set": {
        const listArguments = new ListArguments(components)
        this.position = listArguments.localPosition(0, "position").parse()
        return "set"
      }

      case "set_cachepath": {
        const listArguments = new ListArguments(components)
        this.cachePath = listArguments.boolean(0, "cache path").parse()
        return `set ${this.cachePath}`
      }

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const creep = ((): Creep | null => {
      if (this.creepName == null) {
        return null
      }
      const c = Game.creeps[this.creepName]
      if (c == null) {
        return null
      }
      return c
    })()

    if (creep == null && this.creepName == null) {
      const retrievedCreep = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)[0]
      if (retrievedCreep != null) {
        this.creepName = retrievedCreep.name
        return
      }

      World.resourcePools.addSpawnCreepRequest(this.roomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [],
        body: [TOUGH, MOVE],
        initialTask: null,
        taskIdentifier: this.identifier,
        parentRoomName: null,
      })
    }

    if (creep != null) {
      this.runCreep(creep)
    }
  }

  private runCreep(creep: Creep): void {
    const position = ((): RoomPosition | null => {
      if (this.position == null) {
        return null
      }
      return decodeRoomPosition(this.position, creep.room.name)
    })()

    if (position == null) {
      return
    }
    creep.say(describePosition(position))

    const options: TravelToOptions = {
      cachePath: this.cachePath,
      showPath: true,
    }
    travelTo(creep, position, options)
  }
}
