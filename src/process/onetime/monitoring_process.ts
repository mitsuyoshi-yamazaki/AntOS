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

const hostileRoomConditions = ["safemode", "unclaim", "creep"]
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
    const descriptions: string[] = []
    if (this.lastNoticeMessage != null) {
      descriptions.push("triggered")
    } else {
      descriptions.push("normal")
    }
    descriptions.push(TargetMonitor.shortDescriptionFor(this.target))
    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const args = message.split(" ")
    const commands = ["add", "show"]
    const command = args.shift()
    if (command == null) {
      return `Missing command. Available commands are: ${commands.join(", ")}`
    }

    switch (command) {
    case "add":
      return this.addCondition(args)
    case "show":
      return "Show condition: not implemented yet"
    default:
      return `Unknown command ${command}. Available commands are: ${commands.join(", ")}`
    }
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

  private addCondition(args: string[]): string {
    switch (this.target.case) {
    case "hostile room": {
      const condition = args.shift()
      if (condition == null) {
        return `Condition not specified. Available conditions are: ${hostileRoomConditions}`
      }
      const argmentMap = new Map<string, string>()
      args.forEach(arg => {
        const [key, value] = arg.split("=")
        if (key == null || value == null) {
          return
        }
        argmentMap.set(key, value)
      })
      return this.addHostileRoomCondition(this.target, condition, argmentMap)
    }
    }
  }

  private addHostileRoomCondition(target: TargetHostileRoom, condition: string, args: Map<string, string>): string {
    switch (condition) {
    case "safemode": {
      if (target.conditions.some(condition => condition.case === "safemode")) {
        return `${roomLink(target.roomName)} already has safemode condition`
      }
      const enabled = args.get("enabled")
      if (enabled == null) {
        return "Missing enabled argument"
      }
      const condition: HostileRoomMonitoringConditionSafemode = {
        case: "safemode",
        enabled: enabled === "1",
      }
      target.conditions.push(condition)
      return "safemode condition added"
    }

    case "unclaim": {
      if (target.conditions.some(condition => condition.case === "unclaim")) {
        return `${roomLink(target.roomName)} already has unclaim condition`
      }
      const condition: HostileRoomMonitoringConditionUnclaim = {
        case: "unclaim",
      }
      target.conditions.push(condition)
      return "unclaim condition added"
    }

    case "creep": {
      if (target.conditions.some(condition => condition.case === "creep appeared")) {
        return `${roomLink(target.roomName)} already has creep condition`
      }

      const rawBodyParts = args.get("body")
      if (rawBodyParts == null) {
        return "Missing body argument"
      }
      const bodyParts = ((): BodyPartConstant[] | "any" | string => {
        if (rawBodyParts === "any") {
          return rawBodyParts
        }
        const components = rawBodyParts.toLowerCase().split(",")
        const availableBodyParts: string[] = [...BODYPARTS_ALL]
        for (const body of components) {
          if (availableBodyParts.includes(body) !== true) {
            return `Invalid bodypart ${body}`
          }
        }
        return components as BodyPartConstant[]
      })()
      if (typeof bodyParts === "string") {
        if (bodyParts !== "any") {
          return bodyParts
        }
      }

      const ignoreIrrelevantPlayer = args.get("ignore_irrelevants")
      if (ignoreIrrelevantPlayer == null) {
        return "Missing ignore_irrelevants argument"
      }
      const condition: HostileRoomMonitoringConditionCreepAppeared = {
        case: "creep appeared",
        ignoreIrrelevantPlayer: ignoreIrrelevantPlayer === "1",
        includedBodyParts: bodyParts,
      }
      target.conditions.push(condition)
      return "creep appearing condition added"
    }

    default:
      return `Invalid condition. Available conditions are: ${hostileRoomConditions}`
    }
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
  const conditionDescriptions: string[] = target.conditions.map((condition): string => {
    switch (condition.case) {
    case "creep appeared":
      return "creep"
    case "safemode":
      return "safemode"
    case "unclaim":
      return "unclaim"
    }
  })
  const descriptions: string[] = []
  if (conditionDescriptions.length <= 0) {
    descriptions.push("no conditions")
  } else {
    descriptions.push("conditions:")
  }
  descriptions.push(conditionDescriptions.join(", "))
  descriptions.push(`in ${roomLink(target.roomName)}`)
  return descriptions.join(" ")
}

function currentStateForHostileRoomTarget(target: TargetHostileRoom): string[] {
  const room = Game.rooms[target.roomName]
  if (room == null) {
    return []
  }
  if (room.controller == null) {
    return [`${roomLink(target.roomName)} does not have a controller`]
  }
  const controller = room.controller

  return target.conditions.flatMap((condition): string[] => {
    switch (condition.case) {
    case "creep appeared": {
      const creeps = ((): AnyCreep[] => {
        const hostileCreeps: AnyCreep[] = []
        if (condition.includedBodyParts === "any") {
          hostileCreeps.push(...controller.room.find(FIND_HOSTILE_CREEPS))
          hostileCreeps.push(...controller.room.find(FIND_HOSTILE_POWER_CREEPS))
        } else {
          const includedBodyParts = condition.includedBodyParts
          hostileCreeps.push(
            ...controller.room.find(FIND_HOSTILE_CREEPS)
              .filter(creep => {
                return includedBodyParts.some(body => creep.getActiveBodyparts(body))
              })
          )
        }
        if (condition.ignoreIrrelevantPlayer !== true) {
          return hostileCreeps
        }
        const hostileName = controller.owner?.username
        if (hostileName == null) {
          return []
        }
        return hostileCreeps.filter(creep => creep.owner.username === hostileName)
      })()
      if (creeps[0] == null) {
        return []
      }
      return [`${creeps.length} creeps`]
    }

    case "safemode": {
      const conditionMet = (controller.safeMode != null) && condition.enabled
      if (conditionMet !== true) {
        return []
      }
      const description = ((): string => {
        if (controller.safeMode != null) {
          return `Safemode activated (${controller.safeMode} remaining)`
        }
        return "Safemode deactivated"
      })()
      return [description]
    }

    case "unclaim":
      if (controller.owner != null) {
        return []
      }
      return ["unclaimed"]
    }
  })
}
