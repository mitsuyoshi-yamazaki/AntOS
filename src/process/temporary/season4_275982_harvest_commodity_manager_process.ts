import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"
import { } from "./season4_275982_harvest_commodity_process"

ProcessDecoder.register("Season4275982HarvestCommodityManagerProcess", state => {
  return Season4275982HarvestCommodityManagerProcess.decode(state as Season4275982HarvestCommodityManagerProcessState)
})

export interface Season4275982HarvestCommodityManagerProcessState extends ProcessState {
  readonly parentRoomName: RoomName
  readonly targetRoomNames: RoomName[]
}

export class Season4275982HarvestCommodityManagerProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly parentRoomName: RoomName,
    private readonly targetRoomNames: RoomName[],
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season4275982HarvestCommodityManagerProcessState {
    return {
      t: "Season4275982HarvestCommodityManagerProcess",
      l: this.launchTime,
      i: this.processId,
      parentRoomName: this.parentRoomName,
      targetRoomNames: this.targetRoomNames,
    }
  }

  public static decode(state: Season4275982HarvestCommodityManagerProcessState): Season4275982HarvestCommodityManagerProcess {
    return new Season4275982HarvestCommodityManagerProcess(state.l, state.i, state.parentRoomName, state.targetRoomNames)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomNames: RoomName[]): Season4275982HarvestCommodityManagerProcess {
    return new Season4275982HarvestCommodityManagerProcess(Game.time, processId, parentRoomName, targetRoomNames)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.parentRoomName),
    ]
    return descriptions.join(" ")
  }

  public runOnTick(): void {
  }
}
