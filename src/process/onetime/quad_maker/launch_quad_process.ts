import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { OperatingSystem } from "os/os"
import { ProcessState } from "process/process_state"
import { ProcessDecoder } from "process/process_decoder"
import { Timestamp } from "shared/utility/timestamp"
import { SpecializedQuadLaunchArguments, SpecializedQuadProcess } from "../../../../submodules/private/attack/quad/quad_process"
import { processLog } from "os/infrastructure/logger"
import { QuadSpec, QuadSpecState } from "../../../../submodules/private/attack/quad/quad_spec"
import type { RoomName } from "shared/utility/room_name_types"
import { OwnedRoomProcess } from "process/owned_room_process"

ProcessDecoder.register("LaunchQuadProcess", state => {
  return LaunchQuadProcess.decode(state as LaunchQuadProcessState)
})

type LaunchConditionDelay = {
  case: "delay"
  launchTime: Timestamp
}
type LaunchCondition = LaunchConditionDelay

interface LaunchQuadProcessState extends ProcessState {
  readonly launchCondition: LaunchCondition
  readonly quadLaunchArguments: SpecializedQuadLaunchArguments
  readonly quadSpecState: QuadSpecState
  readonly quadProcessCodename: string | null
}

export class LaunchQuadProcess implements Process, Procedural, OwnedRoomProcess {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get roomName(): RoomName {
    return this.quadLaunchArguments.parentRoomName
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly launchCondition: LaunchCondition,
    private readonly quadLaunchArguments: SpecializedQuadLaunchArguments,
    private readonly quadSpec: QuadSpec,
    readonly quadProcessCodename: string | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}_${this.quadLaunchArguments.parentRoomName}_${this.quadSpec.shortDescription}`
  }

  public encode(): LaunchQuadProcessState {
    return {
      t: "LaunchQuadProcess",
      l: this.launchTime,
      i: this.processId,
      launchCondition: this.launchCondition,
      quadLaunchArguments: this.quadLaunchArguments,
      quadSpecState: this.quadSpec.encode(),
      quadProcessCodename: this.quadProcessCodename,
    }
  }

  public static decode(state: LaunchQuadProcessState): LaunchQuadProcess {
    const quadSpec = QuadSpec.decode(state.quadSpecState)
    return new LaunchQuadProcess(state.l, state.i, state.launchCondition, state.quadLaunchArguments, quadSpec, state.quadProcessCodename)
  }

  public static create(processId: ProcessId, launchCondition: LaunchCondition, quadLaunchArguments: SpecializedQuadLaunchArguments, quadSpec: QuadSpec, quadProcessCodename: string | null): LaunchQuadProcess {
    return new LaunchQuadProcess(
      Game.time,
      processId,
      launchCondition,
      quadLaunchArguments,
      quadSpec,
      quadProcessCodename,
    )
  }

  public processShortDescription(): string {
    const conditionDescription = ((): string => {
      switch (this.launchCondition.case) {
      case "delay":
        return `after ${this.launchCondition.launchTime - Game.time} ticks`
      }
    })()
    return `launch ${this.quadSpec.shortDescription} ${conditionDescription}`
  }

  public runOnTick(): void {
    switch (this.launchCondition.case) {
    case "delay":
      if (Game.time >= this.launchCondition.launchTime) {
        this.launch()
      }
      return
    }
  }

  private launch(): void {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return SpecializedQuadProcess.create(processId, this.quadLaunchArguments, this.quadSpec)
    })
    Memory.os.logger.filteringProcessIds.push(process.processId)

    const launchMessage = `${process.constructor.name} launched. Process ID: ${process.processId}`
    processLog(this, launchMessage)

    OperatingSystem.os.killProcess(this.processId)
  }
}
