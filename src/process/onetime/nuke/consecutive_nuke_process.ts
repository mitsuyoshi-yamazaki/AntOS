import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { processLog } from "os/infrastructure/logger"
import type { RoomName } from "shared/utility/room_name_types"
import type { Timestamp } from "shared/utility/timestamp"
import { OperatingSystem } from "os/os"
import { ProcessDecoder } from "process/process_decoder"
import { decodeRoomPosition, describePosition, Position } from "prototype/room_position"
import { shortenedNumber } from "shared/utility/console_utility"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ObserveNukeLandingProcess } from "./observe_nuke_landing_process"
import { RoomResources } from "room_resource/room_resources"

ProcessDecoder.register("ConsecutiveNukeProcess", state => {
  return ConsecutiveNukeProcess.decode(state as ConsecutiveNukeProcessState)
})


type NukeLaunchResultSucceeded = {
  readonly case: "succeeded"
  readonly targetPosition: Position
  readonly nukerId: Id<StructureNuker>
  readonly launchedRoomName: RoomName
  readonly launchTime: Timestamp
}
type NukeLaunchResultFailed = {
  readonly case: "failed"
  readonly reason: string
}
type NukeLaunchResult = NukeLaunchResultSucceeded | NukeLaunchResultFailed

export type NukeTargetInfo = {
  readonly nukerId: Id<StructureNuker>
  readonly position: Position
}
type NukeInfo = NukeTargetInfo & {
  result: NukeLaunchResult | null
}
type LaunchedNukeInfo = NukeInfo & { readonly result: NukeLaunchResult }
const isLaunched = (info: NukeInfo): info is LaunchedNukeInfo => info.result != null

export interface ConsecutiveNukeProcessState extends ProcessState {
  readonly targetRoomName: RoomName
  readonly nukes: NukeInfo[]
  readonly nukeLaunchTime: Timestamp
  readonly interval: Timestamp
  readonly observerProcessId: ProcessId | null
}

export class ConsecutiveNukeProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly targetRoomName: RoomName,
    private readonly nukes: NukeInfo[],
    private nukeLaunchTime: Timestamp,
    private readonly interval: Timestamp,
    private observerProcessId: ProcessId | null,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.processId}_${this.targetRoomName}`
  }

  public encode(): ConsecutiveNukeProcessState {
    return {
      t: "ConsecutiveNukeProcess",
      l: this.launchTime,
      i: this.processId,
      targetRoomName: this.targetRoomName,
      nukes: this.nukes,
      nukeLaunchTime: this.nukeLaunchTime,
      interval: this.interval,
      observerProcessId: this.observerProcessId,
    }
  }

  public static decode(state: ConsecutiveNukeProcessState): ConsecutiveNukeProcess {
    return new ConsecutiveNukeProcess(state.l, state.i, state.targetRoomName, state.nukes, state.nukeLaunchTime, state.interval, state.observerProcessId)
  }

  public static create(processId: ProcessId, targetRoomName: RoomName, targets: NukeTargetInfo[], delay: Timestamp, interval: Timestamp): ConsecutiveNukeProcess {
    const nukes = targets.map((target): NukeInfo => ({...target, result: null}))
    return new ConsecutiveNukeProcess(Game.time, processId, targetRoomName, nukes, Game.time + delay, interval, null)
  }

  public processShortDescription(): string {
    const timeToLaunch = this.nukeLaunchTime - Game.time
    const launchedNukes = this.nukes.filter(isLaunched)
    const launchedCount = launchedNukes.length

    if (launchedCount <= 0) {
      return `${this.nukes.length} targets in ${roomLink(this.targetRoomName)} in ${shortenedNumber(timeToLaunch)} ticks`
    }

    const nukerCount = this.nukes.length
    const succeededResults = launchedNukes.filter(nuke => nuke.result.case === "succeeded")
    const firstSucceededLaunchResult = succeededResults[0]?.result as NukeLaunchResultSucceeded | null

    if (launchedCount >= nukerCount) {
      // 全て発射済み
      if (firstSucceededLaunchResult == null) {
        return `${this.nukes.length} nukes to ${roomLink(this.targetRoomName)} failed`
      } else {
        return `${this.nukes.length} nukes launched to ${roomLink(this.targetRoomName)} ${shortenedNumber(Game.time - firstSucceededLaunchResult.launchTime)} ticks ago`
      }
    }

    const successCount = succeededResults.length
    const failureCount = launchedCount - successCount
    const remainingNukeCount = this.nukes.length - launchedNukes.length

    return `Succeeded: ${successCount}, failed: ${failureCount}, ${remainingNukeCount} launches remaining. Target: ${roomLink(this.targetRoomName)}, next launch in ${shortenedNumber(timeToLaunch)} ticks`
  }

  public processDescription(): string {
    const descriptions: string[] = [
      this.processShortDescription(),
      ...this.nukes.map((nuke): string => {
        if (nuke.result == null) {
          return `- ready: ${nuke.nukerId} in ${roomLink(Game.getObjectById(nuke.nukerId)?.room.name ?? "")} to ${describePosition(nuke.position)}`
        } else {
          if (nuke.result.case === "succeeded") {
            return `- ${nuke.result.case} ${describePosition(nuke.position)} ${shortenedNumber(Game.time - nuke.result.launchTime)} ticks ago`
          } else {
            return `- ${nuke.result.case} ${describePosition(nuke.position)} ${nuke.result.reason}`
          }
        }
      })
    ]

    return descriptions.join("\n")
  }

  public runOnTick(): void {
    if (this.nukes.filter(nuke => nuke.result == null).length <= 0) {
      PrimitiveLogger.log(coloredText(`ConsecutiveNukeProcess ${this.taskIdentifier}`, "high"))
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const launchUntil = this.nukeLaunchTime - Game.time

    if (launchUntil > 0) {
      if (launchUntil > 10000) {
        this.logCurrentStatus(launchUntil, 10000)
      } else if (launchUntil > 1000) {
        this.logCurrentStatus(launchUntil, 1000)
      } else if (launchUntil > 100) {
        this.logCurrentStatus(launchUntil, 100)
      } else if (launchUntil > 10) {
        this.logCurrentStatus(launchUntil, 10)
      } else {
        this.logCurrentStatus(launchUntil)
      }
      return
    }

    const nextNuke = this.nukes.find(nuke => nuke.result == null)
    if (nextNuke == null) {
      PrimitiveLogger.programError(`ConsecutiveNukeProcess ${this.taskIdentifier} no reamining targets`)
      return
    }

    const result = this.launch(nextNuke)
    switch (result.case) {
    case "succeeded":
      PrimitiveLogger.log(coloredText(`NUKE LAUNCHED!!!! ${roomLink(this.targetRoomName)}`, "high"))

      if (this.observerProcessId == null) {
        const nukeLaunchedRoomResource = RoomResources.getOwnedRoomResource(result.launchedRoomName)
        const observer = nukeLaunchedRoomResource?.activeStructures.observer
        if (observer != null) {
          const process = OperatingSystem.os.addProcess(null, processId => {
            return ObserveNukeLandingProcess.create(processId, this.targetRoomName, observer.id, Game.time + NUKE_LAND_TIME)
          })
          this.observerProcessId = process.processId
        }
      }

      this.nukeLaunchTime += this.interval
      break
    case "failed":
      PrimitiveLogger.fatal(`ConsecutiveNukeProcess ${this.taskIdentifier} launch failed: ${result.reason}`)
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      break
    }
    }

    nextNuke.result = result
  }

  private launch(nukeInfo: NukeInfo): NukeLaunchResult {
    const nuker = Game.getObjectById(nukeInfo.nukerId)
    if (nuker == null) {
      return {
        case: "failed",
        reason: `no nuker with ID ${nukeInfo.nukerId}`,
      }
    }

    const nukerReady = isNukerReady(nuker)
    if (nukerReady !== true) {
      return {
        case: "failed",
        reason: nukerReady,
      }
    }

    const targetPosition = decodeRoomPosition(nukeInfo.position, this.targetRoomName)
    const launchResult = nuker.launchNuke(targetPosition)
    if (launchResult !== OK) {
      return {
        case: "failed",
        reason: `${nuker} ${launchResult}`
      }
    }
    return {
      case: "succeeded",
      targetPosition: nukeInfo.position,
      nukerId: nuker.id,
      launchedRoomName: nuker.room.name,
      launchTime: Game.time,
    }
  }

  private logCurrentStatus(launchUntil: Timestamp, timeUnit?: Timestamp): void {
    if (timeUnit == null) {
      this.log(launchUntil)
      return
    }
    if (launchUntil % timeUnit === 0) {
      this.log(launchUntil)
    }
  }

  private log(launchUntil: Timestamp): void {
    const remainingNukesCount = this.nukes.filter(nuke => nuke.result == null).length
    processLog(this, `${coloredText("[Nuke]", "warn")} ${remainingNukesCount} nukes will launch to ${roomLink(this.targetRoomName)} in ${shortenedNumber(launchUntil)} ticks`)
  }
}

export const isNukerReady = (nuker: StructureNuker, delay?: Timestamp): true | string => {
  if (nuker.cooldown > (delay ?? 0)) {
    return `under cooldown (${nuker.cooldown} > ${delay ?? 0})`
  }
  if (nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    return `lack of energy (${shortenedNumber(nuker.store.getUsedCapacity(RESOURCE_ENERGY))}/${shortenedNumber(nuker.store.getCapacity(RESOURCE_ENERGY))})`
  }
  if (nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
    return `lack of ghodium (${shortenedNumber(nuker.store.getUsedCapacity(RESOURCE_GHODIUM))}/${shortenedNumber(nuker.store.getCapacity(RESOURCE_GHODIUM))})`
  }
  return true
}
