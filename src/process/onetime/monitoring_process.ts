import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { roomLink } from "utility/log"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

ProcessDecoder.register("MonitoringProcess", state => {
  return MonitoringProcess.decode(state as MonitoringProcessState)
})

type HostileRoomMonitoringConditionSafemode = {
  readonly case: "safemode"
  readonly enabled: boolean
}
type HostileRoomMonitoringConditionUnclaim = {
  readonly case: "unclaim"
}
type HostileRoomMonitoringConditionCreepAppeared = {
  readonly case: "creep appeared"
  readonly ignoreIrrelevantPlayer: boolean
  readonly includedBodyParts: BodyPartConstant[] | "any"
}
type HostileRoomMonitoringCondition = HostileRoomMonitoringConditionSafemode | HostileRoomMonitoringConditionUnclaim | HostileRoomMonitoringConditionCreepAppeared
export type TargetHostileRoom = {
  readonly case: "hostile room"
  readonly roomName: RoomName
  readonly conditions: HostileRoomMonitoringCondition[]
}
export type Target = TargetHostileRoom

interface MonitoringProcessState extends ProcessState {
  readonly monitorName: string
  readonly target: Target
  readonly lastNoticeMessage: string | null
}

/**
 * - MonitoringProcess自体は物理実体をもたないため、別Processで実体を送る必要がある
 */
export class MonitoringProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly monitorName: string,
    private readonly target: Target,
    private lastNoticeMessage: string | null
  ) {
    this.identifier = `${this.constructor.name}_${this.monitorName}_${this.processId}`
  }

  public encode(): MonitoringProcessState {
    return {
      t: "MonitoringProcess",
      l: this.launchTime,
      i: this.processId,
      monitorName: this.monitorName,
      target: this.target,
      lastNoticeMessage: this.lastNoticeMessage,
    }
  }

  public static decode(state: MonitoringProcessState): MonitoringProcess {
    return new MonitoringProcess(state.l, state.i, state.monitorName, state.target, state.lastNoticeMessage)
  }

  public static create(processId: ProcessId, name: string, target: Target): MonitoringProcess {
    return new MonitoringProcess(Game.time, processId, name, target, null)
  }

  public processShortDescription(): string {
    return TargetMonitor.shortDescriptionFor(this.target)
  }

  public didReceiveMessage(message: string): string {
    return "not implemented yet"
  }

  public runOnTick(): void {
    const targetState = TargetMonitor.currentStateFor(this.target)
    switch (targetState) {
    case "normal":
    case "no conditions":
      return
    default:
      break
    }

    const info: string[] = [
      this.monitorName,
      targetState,
    ]
    const additionalInfo = TargetMonitor.additionalInfoFor(this.target)
    if (additionalInfo != null) {
      info.push(additionalInfo)
    }
    const notifyMessage = info.join(" ")

    const shouldNotify = ((): boolean => {
      if (this.lastNoticeMessage == null) {
        return true
      }
      if (notifyMessage !== this.lastNoticeMessage) {
        return true
      }
      return false
    })()

    if (shouldNotify !== true) {
      return
    }
    this.lastNoticeMessage = notifyMessage
    PrimitiveLogger.notice(notifyMessage)
  }
}

const TargetMonitor = {
  shortDescriptionFor(target: Target): string {
    switch (target.case) {
    case "hostile room":
      return shortDescriptionForHostileRoomTarget(target)
    }
  },

  currentStateFor(target: Target): "normal" | "no conditions" | string {
    if (target.conditions.length <= 0) {
      return "no conditions"
    }
    const results: string[] = []

    switch (target.case) {
    case "hostile room":
      results.push(...currentStateForHostileRoomTarget(target))
    }

    if (results.length <= 0) {
      return "normal"
    }
    return results.join(", ")
  },

  additionalInfoFor(target: Target): string | null {
    switch (target.case) {
    case "hostile room":
      return `in ${roomLink(target.roomName)}`
    }
  }
}

function shortDescriptionForHostileRoomTarget(target: TargetHostileRoom): string {
  const descriptions: string[] = target.conditions.map((condition): string => {
    switch (condition.case) {
    case "creep appeared":
      return "creep"
    case "safemode":
      return "safemode"
    case "unclaim":
      return "unclaim"
    }
  })
  if (descriptions.length <= 0) {
    descriptions.push("no conditions")
  }
  descriptions.push(`in ${roomLink(target.roomName)}`)
  return descriptions.join(" ")
}

function currentStateForHostileRoomTarget(target: TargetHostileRoom): string[] {
  const room = Game.rooms[target.roomName]
  if (room == null) {
    return [`${roomLink(target.roomName)} does not exists`]
  }
  if (room.controller == null) {
    return [`${roomLink(target.roomName)} does not have a controller`]
  }
  const controller = room.controller

  return target.conditions.flatMap((condition): string[] => {
    switch (condition.case) {
    case "creep appeared":
      // TODO:
      return []

    case "safemode":
      if (controller.safeMode == null) {
        return []
      }
      return [`activated safemode (${controller.safeMode} remaining)`]

    case "unclaim":
      if (controller.owner != null) {
        return []
      }
      return ["unclaimed"]
    }
  })
}
