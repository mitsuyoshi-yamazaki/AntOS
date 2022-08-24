import { Process, ProcessState } from "../process"
import { ProcessType, ProcessTypeConverter } from "../process_type"
import { LaunchMessageObserver } from "../message_observer/launch_message_observer"
import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { OwnedRoomProcess, OwnedRoomProcessState } from "../owned_room_process/owned_room_process"

const processType = "EconomyProcess"

export interface EconomyProcessState extends ProcessState {
}

export class EconomyProcess extends Process implements LaunchMessageObserver {
  public readonly processType = processType

  private constructor(
  ) {
    super()
  }

  public encode(): EconomyProcessState {
    return {
      t: ProcessTypeConverter.convert(this.processType),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(state: EconomyProcessState): EconomyProcess {
    return new EconomyProcess()
  }

  public decodeChildProcess(processType: ProcessType, state: ProcessState): Process | null {
    switch (processType) {
    case "OwnedRoomProcess":
      return OwnedRoomProcess.decode(state as OwnedRoomProcessState)
    default:
      return null
    }
  }

  public static create(): EconomyProcess {
    return new EconomyProcess()
  }

  public shortDescription = (): string => {
    return ""
  }

  /** @throws */
  public didReceiveLaunchMessage(processType: ProcessType, args: ArgumentParser): Process {
    switch (processType) {
    case "OwnedRoomProcess": {
      const roomResource = args.list.ownedRoomResource(0, "room name").parse()
      return OwnedRoomProcess.create(roomResource)
    }
    default:
      throw `${this.constructor.name} doesn't launch ${processType}`
    }
  }

  public run = (): void => {
    if (Game.time % 10 === 0) {
      console.log(`${this.constructor.name} ${this.processId}`)
    }
  }
}
