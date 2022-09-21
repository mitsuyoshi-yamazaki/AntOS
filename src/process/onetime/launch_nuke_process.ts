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
}

export class LaunchNukeProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly targetRoomName: RoomName,
    private readonly targets: NukeTargetInfo[],
    private readonly nukeLaunchTime: Timestamp,
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
    }
  }

  public static decode(state: LaunchNukeProcessState): LaunchNukeProcess {
    return new LaunchNukeProcess(state.l, state.i, state.targetRoomName, state.targets, state.nukeLaunchTime)
  }

  public static create(processId: ProcessId, targetRoomName: RoomName, targets: NukeTargetInfo[], delay: Timestamp): LaunchNukeProcess {
    return new LaunchNukeProcess(Game.time, processId, targetRoomName, targets, Game.time + delay)
  }

  public processShortDescription(): string {
    return `${this.targets.length} targets in ${roomLink(this.targetRoomName)} in ${this.nukeLaunchTime - Game.time} ticks`
  }

  public processDescription(): string {
    const resourceStatus = (nuker: StructureNuker, resourceType: RESOURCE_ENERGY | RESOURCE_GHODIUM): string => {
      return `${coloredResourceType(resourceType)}: ${Math.floor((nuker.store.getUsedCapacity(resourceType) / nuker.store.getCapacity(resourceType)) * 100)}%`
    }
    const nukerStatus = (nukerId: Id<StructureNuker>): string => {
      const nuker = Game.getObjectById(nukerId)
      if (nuker == null || nuker.isActive() !== true) {
        return "no active nuker"
      }

      if (nuker.cooldown > 0 && nuker.store.getFreeCapacity(RESOURCE_ENERGY) <= 0 && nuker.store.getFreeCapacity(RESOURCE_GHODIUM) <= 0) {
        return "nuker ready"
      }

      return `cooldown: ${nuker.cooldown}, ${resourceStatus(nuker, RESOURCE_ENERGY)}, ${resourceStatus(nuker, RESOURCE_GHODIUM)}`
    }


    const descriptions: string[] = [
      `${roomLink(this.targetRoomName)} in ${this.nukeLaunchTime - Game.time} ticks`,
      ...this.targets.map((target): string => `- ${describePosition(target.position)}: ${nukerStatus(target.nukerId)}`),
    ]

    return descriptions.join("\n")
  }

  public runOnTick(): void {
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

    this.launch()
    OperatingSystem.os.suspendProcess(this.processId) // TODO: 動作したらkillに変更する
  }

  private launch(): void {
    const targetObjects = this.targets.map((target): { nuker: StructureNuker | null, position: RoomPosition } => {
      return {
        nuker: Game.getObjectById(target.nukerId) ?? null,
        position: decodeRoomPosition(target.position, this.targetRoomName),
      }
    })

    const isLaunchable = targetObjects.every(target => {
      if (target.nuker == null) {
        return false
      }
      if (isNukerReady(target.nuker) !== true) {
        return false
      }
      return true
    })

    if (isLaunchable !== true) {
      PrimitiveLogger.fatal(`${this.taskIdentifier} nukes not launchable\n${this.processDescription()}`)
      return
    }

    console.log("LAUNCH!!!!") // TODO:
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

export const isNukerReady = (nuker: StructureNuker, delay?: Timestamp): boolean => {
  if (nuker.cooldown > (delay ?? 0)) {
    return false
  }
  if (nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    return false
  }
  if (nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
    return false
  }
  return true
}
