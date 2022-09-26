import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../../process_state"
import type { RoomName } from "shared/utility/room_name_types"
import { Timestamp } from "shared/utility/timestamp"
import { ProcessDecoder } from "process/process_decoder"
import { processLog } from "os/infrastructure/logger"
import { coloredText, roomLink, shortenedNumber } from "utility/log"
import { Position } from "shared/utility/position"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { GameConstants } from "utility/constants"
import { describePosition } from "prototype/room_position"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("ObserveNukeLandingProcess", state => {
  return ObserveNukeLandingProcess.decode(state as ObserveNukeLandingProcessState)
})

type NukeInfo = {
  readonly position: Position
  readonly fromRoomName: RoomName // "undefined" if the room is not visible to me
}
type TargetStructure = {
  readonly structureType: StructureConstant
  readonly position: Position
  readonly rampartHits: number
  readonly estimatedDamage: number
}
type TargetInfo = {
  readonly nukes: NukeInfo[]
  readonly inRangeStructures: TargetStructure[]
}

const nukeDamageRange = GameConstants.structure.nuke.damageRange
const excludedStructureTypes: StructureConstant[] = [
  STRUCTURE_CONTROLLER,
  STRUCTURE_CONTAINER,
  STRUCTURE_ROAD,
]

export interface ObserveNukeLandingProcessState extends ProcessState {
  readonly observerId: Id<StructureObserver>
  readonly targetRoomName: RoomName
  readonly nukeLandingTime: Timestamp
}

export class ObserveNukeLandingProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private observationReserved = false as boolean
  private targetInfo = null as TargetInfo | null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly observerId: Id<StructureObserver>,
    private readonly targetRoomName: RoomName,
    private readonly nukeLandingTime: Timestamp,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): ObserveNukeLandingProcessState {
    return {
      t: "ObserveNukeLandingProcess",
      l: this.launchTime,
      i: this.processId,
      observerId: this.observerId,
      targetRoomName: this.targetRoomName,
      nukeLandingTime: this.nukeLandingTime,
    }
  }

  public static decode(state: ObserveNukeLandingProcessState): ObserveNukeLandingProcess {
    return new ObserveNukeLandingProcess(state.l, state.i, state.observerId, state.targetRoomName, state.nukeLandingTime)
  }

  public static create(processId: ProcessId, targetRoomName: RoomName, observerId: Id<StructureObserver>, nukeLandingTime: Timestamp): ObserveNukeLandingProcess {
    return new ObserveNukeLandingProcess(Game.time, processId, observerId, targetRoomName, nukeLandingTime)
  }

  public processShortDescription(): string {
    const landUntil = this.nukeLandingTime - Game.time
    const nukeInfo = ((): string => {
      if (this.targetInfo == null) {
        return "nuke"
      }
      return `${this.targetInfo.nukes.length} nukes`
    })()

    if (landUntil > 0) {
      return `${nukeInfo} landing to ${roomLink(this.targetRoomName)} in ${shortenedNumber(landUntil)} ticks`
    }
    return `${nukeInfo} landed to ${roomLink(this.targetRoomName)} ${shortenedNumber(-landUntil)} ticks ago`
  }

  public processDescription(): string {
    if (this.targetInfo == null) {
      return this.processShortDescription()
    }
    const landUntil = this.nukeLandingTime - Game.time
    const structuresToDestroy = new Map<StructureConstant, number>()
    const protectedStructures: TargetStructure[] = []

    this.targetInfo.inRangeStructures.forEach(structure => {
      if (structure.rampartHits < structure.estimatedDamage) {
        const structureCount = structuresToDestroy.get(structure.structureType) ?? 0
        structuresToDestroy.set(structure.structureType, structureCount + 1)
        return
      }
      protectedStructures.push(structure)
    })

    const descriptions: string[] = [
      `nuke landing to ${roomLink(this.targetRoomName)} in ${shortenedNumber(landUntil)}`,
      "nukes:",
      ...this.targetInfo.nukes.map(nuke => `- ${describePosition(nuke.position)} from ${roomLink(nuke.fromRoomName)}`),
      "structures to destroy:",
      ...Array.from(structuresToDestroy.entries()).map(([structureType, count]) => `- ${count} ${structureType}`),
      "protected structures",
      ...protectedStructures.map(structure => `- ${structure.structureType} at ${describePosition(structure.position)} (${shortenedNumber(structure.estimatedDamage)}/${shortenedNumber(structure.rampartHits)} damage)`)
    ]

    return descriptions.join("\n")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "observe"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "observe":
        this.reserveObservation()
        return "ok"
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    const landUntil = this.nukeLandingTime - Game.time

    if (this.observationReserved === true) {
      this.observationReserved = false
      const targetRoom = Game.rooms[this.targetRoomName]
      if (targetRoom != null) {
        this.targetInfo = this.getTargetInfo(targetRoom)
        this.log(landUntil, this.targetInfo)
      } else {
        PrimitiveLogger.programError(`${this.taskIdentifier} failed to get ${roomLink(this.targetRoomName)}`)
      }
    }

    if (landUntil === 0) {
      processLog(this, `${coloredText("[Nuke]", "warn")} nuke landing\n${this.processDescription()}`)
      return
    }
    if (landUntil < 0) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    if (landUntil > 10000) {
      this.logCurrentStatus(landUntil, 10000)
    } else if (landUntil > 1000) {
      this.logCurrentStatus(landUntil, 1000)
    } else if (landUntil > 100) {
      this.logCurrentStatus(landUntil, 100)
    } else if (landUntil > 10) {
      this.logCurrentStatus(landUntil, 10)
    } else {
      this.logCurrentStatus(landUntil)
    }
  }

  private logCurrentStatus(landUntil: Timestamp, timeUnit?: Timestamp): void {
    if (timeUnit == null) {
      if (this.targetInfo == null) {
        this.reserveObservation() // targetInfo設定の際にログに出している
        return
      }
      this.log(landUntil, this.targetInfo)
      return
    }
    if (landUntil % timeUnit === 0) {
      if (this.targetInfo == null) {
        this.reserveObservation()
        return
      }
      this.log(landUntil, this.targetInfo)
    }
  }

  private log(landUntil: Timestamp, targetInfo: TargetInfo): void {
    processLog(this, `${coloredText("[Nuke]", "warn")} ${targetInfo.nukes.length} nukes will land to ${roomLink(this.targetRoomName)} in ${shortenedNumber(landUntil)} ticks`)
  }

  private reserveObservation(): void {
    const observer = Game.getObjectById(this.observerId)
    if (observer == null) {
      PrimitiveLogger.fatal(`${this.taskIdentifier} observer with ID ${this.observerId} not found`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    this.observationReserved = true
    observer.observeRoom(this.targetRoomName)
  }

  private getTargetInfo(targetRoom: Room): TargetInfo {
    const nukes: NukeInfo[] =[]
    const inRangeStructures = new Map<string, Structure>()
    const inRangeRamparts = new Map<string, StructureRampart>()

    targetRoom.find(FIND_NUKES).forEach(nuke => {
      nukes.push({
        position: { x: nuke.pos.x, y: nuke.pos.y },
        fromRoomName: `${nuke.room?.name}`,
      })

      nuke.pos.findInRange(FIND_HOSTILE_STRUCTURES, nukeDamageRange).forEach(structure => {
        const positionIdentifier = describePosition(structure.pos)
        if (structure.structureType === STRUCTURE_RAMPART) {
          inRangeRamparts.set(positionIdentifier, structure)
        } else {
          if (excludedStructureTypes.includes(structure.structureType) !== true) {
            inRangeStructures.set(positionIdentifier, structure)
          }
        }
      })
    })

    const nukePositions: Position[] = nukes.map(nuke => nuke.position)
    const targetStructures: TargetStructure[] = Array.from(inRangeStructures.entries()).map(([positionIdentifier, structure]) => {
      const rampart = inRangeRamparts.get(positionIdentifier)

      return {
        structureType: structure.structureType,
        position: structure.pos,
        rampartHits: rampart?.hits ?? 0,
        estimatedDamage: this.calculateDamage(structure.pos, nukePositions)
      }
    })

    return {
      nukes,
      inRangeStructures: targetStructures,
    }
  }

  private calculateDamage(position: RoomPosition, nukePositions: Position[]): number {
    return nukePositions.reduce((result, current) => {
      const range = position.getRangeTo(current.x, current.y)
      if (range > nukeDamageRange) {
        return result
      }
      if (range > 0) {
        return result + (NUKE_DAMAGE[2] ?? 0)
      }
      return result + (NUKE_DAMAGE[0] ?? 0)
    }, 0)
  }
}
