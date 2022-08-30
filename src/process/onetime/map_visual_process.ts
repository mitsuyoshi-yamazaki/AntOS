import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText } from "utility/log"
import { ProcessState } from "../process_state"
import { processLog } from "os/infrastructure/logger"
import { Timestamp } from "shared/utility/timestamp"
import { OperatingSystem } from "os/os"
import { ProcessDecoder } from "process/process_decoder"
import { GameConstants } from "utility/constants"

ProcessDecoder.register("MapVisualProcess", state => {
  return MapVisualProcess.decode(state as MapVisualProcessState)
})

export interface MapVisualProcessState extends ProcessState {
  readonly until: Timestamp
}

export class MapVisualProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly until: Timestamp,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): MapVisualProcessState {
    return {
      t: "MapVisualProcess",
      l: this.launchTime,
      i: this.processId,
      until: this.until,
    }
  }

  public static decode(state: MapVisualProcessState): MapVisualProcess {
    return new MapVisualProcess(state.l, state.i, state.until)
  }

  public static create(processId: ProcessId, duration: Timestamp): MapVisualProcess {
    PrimitiveLogger.log(`${coloredText("[Info]", "info")} MapVisualProcess only shows visual in the alpha version world map`)
    return new MapVisualProcess(Game.time, processId, Game.time + duration)
  }

  public processShortDescription(): string {
    return `in ${this.until - Game.time} ticks`
  }

  public runOnTick(): void {
    if (this.until < Game.time) {
      processLog(this, `${coloredText("Finished", "warn")}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }

    const rooms = Array.from(Object.values(Game.rooms)).filter(room => {
      if (room.controller == null) {
        return false
      }
      if (room.controller.my === true) {
        return true
      }
      if (room.controller.reservation?.username === Game.user.name) {
        return true
      }
      return false
    })

    const roomSize = GameConstants.room.size
    const drawStyle: MapPolyStyle = {
      fill: "#72e742",
      opacity: 0.4,
    }

    try {
      rooms.forEach(room => {
        Game.map.visual.rect(new RoomPosition(0, 0, room.name), roomSize, roomSize, drawStyle)
      })
    } catch (error) {
      PrimitiveLogger.programError(`${coloredText("[Error]", "error")} ${this.constructor.name} ${this.processId} ${error}`)
    }
  }
}
