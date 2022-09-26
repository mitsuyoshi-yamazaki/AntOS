import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { processLog } from "os/infrastructure/logger"
import type { RoomName } from "shared/utility/room_name_types"
import type { Timestamp } from "shared/utility/timestamp"
import { OperatingSystem } from "os/os"
import { ProcessDecoder } from "process/process_decoder"
import { decodeRoomPosition, describePosition, Position } from "prototype/room_position"
import { shortenedNumber } from "shared/utility/console_utility"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

ProcessDecoder.register("LaunchNukeProcess", state => {
  return LaunchNukeProcess.decode(state as LaunchNukeProcessState)
})

export type NukeTargetInfo = {
  readonly nukerId: Id<StructureNuker>
  readonly position: Position
}

export interface LaunchNukeProcessState extends ProcessState {
  readonly targetRoomName: RoomName
  readonly targets: NukeTargetInfo[]
  readonly nukeLaunchTime: Timestamp
  readonly result: "succeeded" | string | null // failed reason
}

// TODO: 時間差攻撃によってSpawn中だったCreep等を破壊する
export class LaunchNukeProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly targetRoomName: RoomName,
    private readonly targets: NukeTargetInfo[],
    private readonly nukeLaunchTime: Timestamp,
    private result: "succeeded" | string | null, // failed reason
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.processId}_${this.targetRoomName}`
  }

  public encode(): LaunchNukeProcessState {
    return {
      t: "LaunchNukeProcess",
      l: this.launchTime,
      i: this.processId,
      targetRoomName: this.targetRoomName,
      targets: this.targets,
      nukeLaunchTime: this.nukeLaunchTime,
      result: this.result,
    }
  }

  public static decode(state: LaunchNukeProcessState): LaunchNukeProcess {
    return new LaunchNukeProcess(state.l, state.i, state.targetRoomName, state.targets, state.nukeLaunchTime, state.result)
  }

  public static create(processId: ProcessId, targetRoomName: RoomName, targets: NukeTargetInfo[], delay: Timestamp): LaunchNukeProcess {
    return new LaunchNukeProcess(Game.time, processId, targetRoomName, targets, Game.time + delay, null)
  }

  public processShortDescription(): string {
    const timeToLaunch = this.nukeLaunchTime - Game.time
    if (this.result == null) {
      return `${this.targets.length} targets in ${roomLink(this.targetRoomName)} in ${shortenedNumber(timeToLaunch)} ticks`
    }

    const result = this.result === "succeeded" ? "succeeded" : "failed"
    return `${this.targets.length} nukes launched to ${roomLink(this.targetRoomName)} ${shortenedNumber(-timeToLaunch)} ticks ago: ${result}`
  }

  public processDescription(): string {
    const timeToLaunch = this.nukeLaunchTime - Game.time

    const resourceStatus = (nuker: StructureNuker, resourceType: RESOURCE_ENERGY | RESOURCE_GHODIUM): string => {
      return `${coloredResourceType(resourceType)}: ${Math.floor((nuker.store.getUsedCapacity(resourceType) / nuker.store.getCapacity(resourceType)) * 100)}%`
    }
    const nukerStatus = (nukerId: Id<StructureNuker>): string => {
      const nuker = Game.getObjectById(nukerId)
      if (nuker == null || nuker.isActive() !== true) {
        return "no active nuker"
      }

      if (nuker.cooldown < timeToLaunch && nuker.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 && nuker.store.getFreeCapacity(RESOURCE_GHODIUM) <= 0) {
        if (nuker.cooldown > 0) {
          return `nuker in ${roomLink(nuker.room.name)} ready (cooldown: ${shortenedNumber(nuker.cooldown)})`
        }
        return `nuker in ${roomLink(nuker.room.name)} ready`
      }

      return `nuker in ${roomLink(nuker.room.name)} cooldown: ${nuker.cooldown}, ${resourceStatus(nuker, RESOURCE_ENERGY)}, ${resourceStatus(nuker, RESOURCE_GHODIUM)}`
    }

    const overview = ((): string => {
      if (this.result == null) {
        return `launch nukes to ${roomLink(this.targetRoomName)} in ${shortenedNumber(timeToLaunch)} ticks`
      }
      const result = this.result === "succeeded" ? "succeeded" : "failed"
      const timeToLand = NUKE_LAND_TIME + timeToLaunch
      if (timeToLand > 0) {
        return `nukes launched to ${roomLink(this.targetRoomName)} ${shortenedNumber(-timeToLaunch)} ticks ago: ${result}, estimated landing in ${shortenedNumber(timeToLand)} ticks`
      }
      return `nukes launched to ${roomLink(this.targetRoomName)} ${shortenedNumber(-timeToLaunch)} ticks ago: ${result}, landed ${shortenedNumber(-timeToLand)} ticks ago`
    })()

    const descriptions: string[] = [
      overview,
      ...this.targets.map((target): string => `- ${describePosition(target.position)}: ${nukerStatus(target.nukerId)}`),
    ]

    if (this.result != null && this.result !== "succeeded") {
      descriptions.push(`failed reasons:\n${this.result}`)
    }

    return descriptions.join("\n")
  }

  public runOnTick(): void {
    if (this.result != null) {
      processLog(this, `${coloredText("[Warning]", "warn")} nuke launched but process is still running`)
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

    this.result = this.launch()
    OperatingSystem.os.suspendProcess(this.processId) // TODO: 動作したらkillに変更する
    // TODO: Nuke Observer Processを起動する
  }

  private launch(): "succeeded" | string | null {
    const targetObjects = this.targets.map((target): { nukerId: Id<StructureNuker>, nuker: StructureNuker | null, position: RoomPosition } => {
      return {
        nukerId: target.nukerId,
        nuker: Game.getObjectById(target.nukerId) ?? null,
        position: decodeRoomPosition(target.position, this.targetRoomName),
      }
    })

    const unreadyReasons = targetObjects.flatMap((target): string[] => {
      if (target.nuker == null) {
        return [`no nuker with ID ${target.nukerId}`]
      }
      const result = isNukerReady(target.nuker)
      if (result !== true) {
        return [result]
      }
      return []
    })

    if (unreadyReasons.length > 0) {
      const reason = unreadyReasons.map(reason => `- ${reason}`).join("\n")
      PrimitiveLogger.fatal(`${this.taskIdentifier} nukes not launchable\n${reason}`)
      return reason
    }

    const failedReasons = targetObjects.flatMap((target): string[] => {
      if (target.nuker == null) {
        return [`no nuker with ID ${target.nukerId}`]
      }

      const result = target.nuker.launchNuke(target.position)
      if (result !== OK) {
        return [`${target.nuker} to ${target.position} failed with ${result}`]
      }
      return []
    })

    PrimitiveLogger.log(coloredText(`NUKE LAUNCH!!!! ${roomLink(this.targetRoomName)}`, "high"))

    if (failedReasons.length > 0) {
      const reason = failedReasons.map(reason => `- ${reason}`).join("\n")
      PrimitiveLogger.fatal(`${failedReasons.length}/${targetObjects.length} nukes failed to launch:\n${reason}`)
      return reason
    }
    return "succeeded"
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
    processLog(this, `${coloredText("[Nuke]", "warn")} ${this.targets.length} nukes will launch to ${roomLink(this.targetRoomName)} in ${shortenedNumber(launchUntil)} ticks`)
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
