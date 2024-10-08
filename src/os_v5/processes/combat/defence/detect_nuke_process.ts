import { ProcessDependencies, ProcessId, ReadonlySharedMemory, BotSpecifier, Process } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { BotTypes } from "os_v5/process/process_type_map"
import { BotApi } from "os_v5/processes/bot/types"
import { RoomName } from "shared/utility/room_name_types"
import { Timestamp } from "shared/utility/timestamp"
import { strictEntries } from "shared/utility/strict_entries"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

type Dependency = BotApi

type NukeInfo = {
  readonly l: Timestamp /// Landing time
}

type DetectNukeProcessState = {
  readonly id: string   /// Process identifier
  readonly b: BotTypes  /// Bot process type
  readonly bi: string   /// Bot process identifier
  readonly n: {[R: RoomName]: NukeInfo} /// Nuke info
}

ProcessDecoder.register("DetectNukeProcess", (processId: DetectNukeProcessId, state: DetectNukeProcessState) => DetectNukeProcess.decode(processId, state))

export type DetectNukeProcessId = ProcessId<Dependency, string, void, DetectNukeProcessState, DetectNukeProcess>

const checkInterval = 163

export class DetectNukeProcess extends Process<Dependency, string, void, DetectNukeProcessState, DetectNukeProcess> {
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private nextCheck = Game.time + checkInterval

  private constructor(
    public readonly processId: DetectNukeProcessId,
    public readonly identifier: string,
    private readonly botSpecifier: BotSpecifier,
    private nukeInfo: { [R: RoomName]: NukeInfo },
  ) {
    super()

    this.dependencies.processes.push(this.botSpecifier)
  }

  public encode(): DetectNukeProcessState {
    return {
      id: this.identifier,
      b: this.botSpecifier.processType,
      bi: this.botSpecifier.identifier,
      n: this.nukeInfo,
    }
  }

  public static decode(processId: DetectNukeProcessId, state: DetectNukeProcessState): DetectNukeProcess {
    const botSpecifier: BotSpecifier = {
      processType: state.b,
      identifier: state.bi,
    }
    return new DetectNukeProcess(
      processId,
      state.id,
      botSpecifier,
      state.n)
  }

  public static create(processId: DetectNukeProcessId, identifier: string, botSpecifier: BotSpecifier): DetectNukeProcess {
    return new DetectNukeProcess(processId, identifier, botSpecifier, {})
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const nukes = strictEntries(this.nukeInfo) as [string, NukeInfo][]
    if (nukes.length <= 0) {
      return "no nukes"
    }

    nukes.sort((lhs, rhs) => lhs[1].l - rhs[1].l)

    if (nukes.length > 2 && nukes[0] != null) {
      return `${nukes.length} nukes, closest landing in ${nukes[0][1].l} in ${ConsoleUtility.roomLink(nukes[0][0])}`
    }

    return nukes.map(nuke => `${nuke[1].l} in ${ConsoleUtility.roomLink(nuke[0])}`).join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): void {
    if (Game.time < this.nextCheck) {
      return
    }

    this.findNukes(dependency)
    this.nextCheck = Game.time + checkInterval
  }


  // ---- Private ---- //
  private findNukes(dependency: Dependency): void {
    this.nukeInfo = {}

    dependency.getManagingRooms().forEach(room => {
      const nukes = room.find(FIND_NUKES)
      if (nukes.length <= 0) {
        return
      }

      const closestLandingTime = nukes.reduce((closest, current) => closest > current.timeToLand ? closest : current.timeToLand, 0)

      this.nukeInfo[room.name] = {
        l: closestLandingTime,
      }
    })
  }
}
