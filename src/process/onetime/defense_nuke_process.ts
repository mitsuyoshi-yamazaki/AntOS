import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { UniqueId } from "utility/unique_id"
import { Timestamp } from "utility/timestamp"
import { Position } from "prototype/room_position"
import { GameConstants } from "utility/constants"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("DefenseNukeProcess", state => {
  return DefenseNukeProcess.decode(state as DefenseNukeProcessState)
})

type NukeInfo = {
  readonly nukeId: Id<Nuke>
  readonly landAt: Timestamp
}

type GuardPosition = {
  readonly position: Position
  rampartId: Id<StructureRampart> | null
  minimumHits: number
}

type DefenseInfo = {
  readonly guardPositions: GuardPosition[]
  readonly nukes: NukeInfo[]
}

interface DefenseNukeProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly defenseInfo: DefenseInfo
}

export class DefenseNukeProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly defenseInfo: DefenseInfo,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = UniqueId.generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DefenseNukeProcessState {
    return {
      t: "DefenseNukeProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      defenseInfo: this.defenseInfo,
    }
  }

  public static decode(state: DefenseNukeProcessState): DefenseNukeProcess {
    return new DefenseNukeProcess(state.l, state.i, state.roomName, state.defenseInfo)
  }

  public static create(processId: ProcessId, roomName: RoomName, nukes: Nuke[]): DefenseNukeProcess {
    const defenseInfo = addNukes(nukes, {guardPositions: [], nukes: []})
    return new DefenseNukeProcess(Game.time, processId, roomName, defenseInfo)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
      `${this.defenseInfo.nukes.length} nukes`,
      `${this.defenseInfo.guardPositions.length} positions to defense`,
    ]

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "show_visual"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.processShortDescription()

      case "show_visual":
        this.showDefensePositions()
        return `${this.defenseInfo.guardPositions.length} positions to defense`

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private showDefensePositions(): void {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      throw `${roomLink(this.roomName)} invisible`
    }

    const color = "#FF00FF"
    const text = (requiredHits: number): string => {
      return Math.max(Math.ceil(requiredHits / 1000000), 1).toFixed(0)
    }

    this.defenseInfo.guardPositions.forEach(position => {
      room.visual.text(text(position.minimumHits), position.position.x, position.position.y, {color})
    })
  }

  public runOnTick(): void {

  }
}

const addNukes = (nukes: Nuke[], defenseInfo: DefenseInfo): DefenseInfo => {
  defenseInfo.nukes.push(...nukes.map(nuke => {
    const nukeInfo: NukeInfo = {
      nukeId: nuke.id,
      landAt: nuke.timeToLand + Game.time,
    }
    return nukeInfo
  }))

  const nukeDamageRange = GameConstants.nuke.damageRange
  const minGuardPosition = GameConstants.room.edgePosition.min + 1
  const maxGuardPosition = GameConstants.room.edgePosition.max - 1
  const excludedOwnedStructureTypes: StructureConstant[] = [
    STRUCTURE_EXTENSION,
    STRUCTURE_EXTRACTOR,
    STRUCTURE_CONTROLLER,
  ]
  const wallMinimumHits = 2000000

  nukes.forEach(nuke => {
    const room = nuke.room
    if (room == null) {
      PrimitiveLogger.programError(`DefenseNukeProcess nuke.room is undefined (${nuke} at ${roomLink(nuke.pos.roomName)})`)
      return
    }

    for (let j = -nukeDamageRange; j <= nukeDamageRange; j += 1) {
      for (let i = -nukeDamageRange; i <= nukeDamageRange; i += 1) {
        const x = nuke.pos.x + i
        const y = nuke.pos.y + j
        if (x < minGuardPosition || x > maxGuardPosition || y < minGuardPosition || y > maxGuardPosition) {
          continue
        }

        const ownedStructures = room.find(FIND_MY_STRUCTURES)
        const anyStructure = ownedStructures[0]
        if (anyStructure == null) {
          continue
        }

        if (ownedStructures.length <= 1 && excludedOwnedStructureTypes.includes(anyStructure.structureType) === true) {
          continue
        }

        const position = ((): GuardPosition => {
          const stored = defenseInfo.guardPositions.find(pos => pos.position.x === x && pos.position.y === y)
          if (stored != null) {
            return stored
          }

          const rampartId = ((): Id<StructureRampart> | null => {
            return (ownedStructures.find(structure => structure.structureType === STRUCTURE_RAMPART) as StructureRampart | undefined)?.id ?? null
          })()
          const newPosition: GuardPosition = {
            position: { x, y },
            rampartId,
            minimumHits: wallMinimumHits,
          }
          defenseInfo.guardPositions.push(newPosition)
          return newPosition
        })()

        const range = Math.min(i, j)
        const estimatedDamage = GameConstants.nuke.damage(range)
        position.minimumHits += estimatedDamage
      }
    }
  })

  return defenseInfo
}
