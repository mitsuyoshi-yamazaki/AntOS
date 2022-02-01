import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { generateCodename } from "utility/unique_id"
import { GclFarmProcess } from "./gcl_farm_process"
import { OperatingSystem } from "os/os"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

ProcessDecoder.register("GclFarmManagerProcess", state => {
  return GclFarmManagerProcess.decode(state as GclFarmManagerProcessState)
})

type GclFarmRoom = {
  readonly roomName: RoomName
  readonly parentRoomNames: RoomName[]
}

interface GclFarmManagerProcessState extends ProcessState {
  readonly targetRooms: GclFarmRoom[]
  readonly targetRoomIndex: number
  readonly farmProcessId: ProcessId | null
}

export class GclFarmManagerProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string
  private farmProcess: GclFarmProcess | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly targetRooms: GclFarmRoom[],
    private targetRoomIndex: number,
    private farmProcessId: ProcessId | null
  ) {
    this.identifier = `${this.constructor.name}_${this.targetRooms.map(target => target.roomName).join("_")}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    if (farmProcessId != null) {
      const farmProcess = OperatingSystem.os.processOf(farmProcessId)
      if (farmProcess instanceof GclFarmProcess) {
        this.farmProcess = farmProcess
      } else {
        this.farmProcessId = null
      }
    }
  }

  public encode(): GclFarmManagerProcessState {
    return {
      t: "GclFarmManagerProcess",
      l: this.launchTime,
      i: this.processId,
      targetRooms: this.targetRooms,
      targetRoomIndex: this.targetRoomIndex,
      farmProcessId: this.farmProcessId,
    }
  }

  public static decode(state: GclFarmManagerProcessState): GclFarmManagerProcess {
    return new GclFarmManagerProcess(state.l, state.i, state.targetRooms, state.targetRoomIndex, state.farmProcessId)
  }

  public static create(processId: ProcessId, targetRooms: GclFarmRoom[]): GclFarmManagerProcess {
    return new GclFarmManagerProcess(Game.time, processId, targetRooms, 0, null)
  }

  public processShortDescription(): string {
    const roomDescription = (roomNames: RoomName[]): string => {
      return roomNames.map(roomName => roomLink(roomName)).join(",")
    }
    return `${roomDescription(this.targetRooms.map(target => target.roomName))}`
  }

  public runOnTick(): void {
    if (this.farmProcess == null) {
      this.launchFarm()
      return
    }
    if (this.shouldFinishCurrentFarm(this.farmProcess) === true) {
      this.teardownFarm(this.farmProcess)
      return
    }
  }

  private shouldFinishCurrentFarm(farmProcess: GclFarmProcess): boolean {
    const roomResource = RoomResources.getOwnedRoomResource(farmProcess.roomName)
    if (roomResource == null) {
      return true
    }
    return roomResource.controller.level >= 8
  }

  private teardownFarm(farmProcess: GclFarmProcess): void {
    // TODO:

    if (this.targetRooms.length <= 0) {
      if ((Game.time % 29) === 11) {
        PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} no target rooms`)
      }
      return
    }
    this.targetRoomIndex = (this.targetRoomIndex + 1) % this.targetRooms.length
  }

  private launchFarm(): void {
    // TODO:
  }
}
