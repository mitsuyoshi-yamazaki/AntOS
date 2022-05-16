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
import { coloredText, roomLink, shortenedNumber } from "utility/log"
import { MessageObserver } from "os/infrastructure/message_observer"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepRole } from "prototype/creep_role"
import { CreepBody } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { ResourceManager } from "utility/resource_manager"
import { processLog } from "os/infrastructure/logger"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"

ProcessDecoder.register("DefenseNukeProcess", state => {
  return DefenseNukeProcess.decode(state as DefenseNukeProcessState)
})

const StopSpawningReason = {
  manually: "manually",
  noNukes: "no nukes",
}

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

type CalculateInfo = {
  readonly excludedStructureIds: Id<AnyOwnedStructure>[]
}

interface DefenseNukeProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly defenseInfo: DefenseInfo
  readonly calculateInfo: CalculateInfo
  readonly stopSpawningReasons: string[]
}

export class DefenseNukeProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string
  // private rampartsToRepair: (ConstructionSite<STRUCTURE_RAMPART> | StructureRampart)[] = []
  private ramparts: { all: StructureRampart[], rampartsToRepair: StructureRampart[] } | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private defenseInfo: DefenseInfo,
    private readonly calculateInfo: CalculateInfo,
    private stopSpawningReasons: string[],
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
      calculateInfo: this.calculateInfo,
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: DefenseNukeProcessState): DefenseNukeProcess {
    return new DefenseNukeProcess(
      state.l,
      state.i,
      state.roomName,
      state.defenseInfo,
      state.calculateInfo,
      state.stopSpawningReasons ?? [], // FixMe: Migration
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, nukes: Nuke[], excludedStructureIds: Id<AnyOwnedStructure>[]): DefenseNukeProcess {
    const calculateInfo: CalculateInfo = {
      excludedStructureIds,
    }
    const defenseInfo = addNukes(nukes, { guardPositions: [], nukes: [] }, calculateInfo)
    return new DefenseNukeProcess(Game.time, processId, roomName, defenseInfo, calculateInfo, [])
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
      `${this.defenseInfo.nukes.length} nukes`,
      `${this.defenseInfo.guardPositions.length} positions to defense`,
    ]

    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`spawn stopped by: ${this.stopSpawningReasons.join(",")}`)
    }

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "stop", "resume", "show_visual", "recalculate", "excluded", "add_guard_positions"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.processShortDescription()

      case "stop":
        this.addStopSpawningReason(StopSpawningReason.manually)
        return "ok"

      case "resume": {
        const oldValues = this.stopSpawningReasons
        this.stopSpawningReasons = []
        return `resumed (from: ${oldValues.join(", ")})`
      }

      case "show_visual":
        this.showDefensePositions()
        return `${this.defenseInfo.guardPositions.length} positions to defense`

      case "recalculate":
        return this.recalculate()

      case "excluded":
        return this.excluded(components)

      case "add_guard_positions":
        return this.addGuardPositions(components)

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private addGuardPositions(args: string[]): string {
    // recalculateでリセットされる
    const listArguments = new ListArguments(args)
    const hits = listArguments.int(0, "hits").parse({ min: 1, max: 300000000 })
    const rampartIds = listArguments.list(1, "rampart IDs", "string").parse() as Id<StructureRampart>[]

    rampartIds.forEach(rampartId => {
      const stored = this.defenseInfo.guardPositions.find(position => position.rampartId === rampartId)
      if (stored != null) {
        if (stored.minimumHits < hits) {
          stored.minimumHits = hits
        }
        return
      }

      const rampart = Game.getObjectById(rampartId)
      if (rampart == null) {
        throw `no rampart with ID ${rampartId}`
      }
      if (!(rampart instanceof StructureRampart)) {
        throw `${rampart} is not a rampart`
      }
      this.defenseInfo.guardPositions.push({
        position: { x: rampart.pos.x, y: rampart.pos.y },
        rampartId,
        minimumHits: hits,
      })
    })

    const totalHits = this.defenseInfo.guardPositions.reduce((result, position) => {
      if (position.rampartId == null) {
        return result + position.minimumHits
      }
      const rampart = Game.getObjectById(position.rampartId)
      if (rampart == null) {
        return result + position.minimumHits
      }
      return result + Math.max(position.minimumHits - rampart.hits, 0)
    }, 0)

    const results: string[] = [
      `${rampartIds.length} ramparts added to guard positions`,
      `(${this.defenseInfo.guardPositions.length} total, total hits: ${shortenedNumber(totalHits)})`,
    ]

    if (this.stopSpawningReasons.length > 0) {
      results.push(`${coloredText("make sure resume spawning!", "warn")}`)
    }

    return results.join(" ")
  }

  /** @throws */
  private excluded(args: string[]): string {
    const listArguments = new ListArguments(args)
    const command = listArguments.string(0, "command").parse()

    switch (command) {
    case "add": {
      const obj = listArguments.visibleGameObject(1, "structure ID").parse({ inRoomName: this.roomName }) as {id?: Id<AnyOwnedStructure>}
      if (obj.id == null) {
        throw `${obj} is not a structure`
      }
      if (this.calculateInfo.excludedStructureIds.includes(obj.id) === true) {
        throw `${obj} is already excluded`
      }
      this.calculateInfo.excludedStructureIds.push(obj.id)
      return "ok"
    }

    case "remove": {
      const obj = listArguments.visibleGameObject(1, "structure ID").parse({ inRoomName: this.roomName }) as { id?: Id<AnyOwnedStructure> }
      if (obj.id == null) {
        throw `${obj} is not a structure`
      }
      const index = this.calculateInfo.excludedStructureIds.indexOf(obj.id)
      if (index < 0) {
        throw `${obj} is not excluded`
      }
      this.calculateInfo.excludedStructureIds.splice(index, 1)
      return "ok"
    }

    default:
      throw `invalid command ${command}, available commands: add, remove`
    }
  }

  /** @throws */
  private recalculate(): string {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      throw `no visible for ${roomLink(this.roomName)}`
    }

    const nukes = room.find(FIND_NUKES)
    this.defenseInfo = addNukes(nukes, { guardPositions: [], nukes: [] }, this.calculateInfo)

    return this.processShortDescription()
  }

  /** @throws */
  private showDefensePositions(): void {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      throw `no visible for ${roomLink(this.roomName)}`
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
    this.ramparts = null

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    if (this.defenseInfo.nukes.some(nukeInfo => Game.getObjectById(nukeInfo.nukeId) == null) === true) {
      this.defenseInfo = addNukes(roomResource.nukes, { guardPositions: [], nukes: [] }, this.calculateInfo)
      PrimitiveLogger.notice(`${coloredText("[Warning]", "warn")} Nuke landed in ${roomLink(this.roomName)}, recalculate defense info`)

      if (roomResource.nukes.length <= 0) {
        this.addStopSpawningReason(StopSpawningReason.noNukes)
        processLog(this, `No more nukes in ${roomLink(this.roomName)}`)
      }
    }

    if (this.defenseInfo.nukes.length <= 0 && roomResource.nukes.length > 0) {
      this.removeStopSpawningReason(StopSpawningReason.noNukes)
      this.defenseInfo = addNukes(roomResource.nukes, { guardPositions: [], nukes: [] }, this.calculateInfo)
      PrimitiveLogger.fatal(`${coloredText("[Warning]", "error")} Nuke launch detected in ${roomLink(this.roomName)}, recalculate defense info`)
    }

    if ((Game.time % 503) === 0 && this.stopSpawningReasons.length <= 0) {
      if (this.ramparts == null) {
        this.ramparts = this.calculateRampartsToRepair()
      }
      if (this.ramparts.rampartsToRepair.length > 0 && roomResource.getResourceAmount(RESOURCE_ENERGY) < 100000) {
        const collectAmount = 50000
        const result = ResourceManager.collect(RESOURCE_ENERGY, this.roomName, collectAmount)
        switch (result.resultType) {
        case "succeeded":
          break
        case "failed":
          processLog(this, `collecting energy failed (${result.reason.sentAmount}/${collectAmount}), ${result.reason.errorMessage}`)
          break
        }
      }
    }

    const shouldSpawn = ((): boolean => {
      if (this.stopSpawningReasons.length > 0) {
        return false
      }

      const creepMaxCount = 3
      const creepCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)

      if (creepCount >= creepMaxCount) {
        return false
      }

      if (roomResource.getResourceAmount(RESOURCE_ENERGY) < 20000) {
        return false
      }

      if (this.ramparts == null) {
        this.ramparts = this.calculateRampartsToRepair()
      }
      if (this.ramparts.rampartsToRepair.length <= 0) {
        return false
      }

      return true
    })()

    if (shouldSpawn === true) {
      this.spawnRepairer(roomResource.room.energyCapacityAvailable)
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTaskFor(creep, roomResource),
      () => true,
    )
  }

  private newTaskFor(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      const energySource = ((): StructureStorage | StructureTerminal | null => {
        if ((roomResource.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) > 0) {
          return roomResource.activeStructures.terminal
        }
        if ((roomResource.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) > 0) {
          return roomResource.activeStructures.storage
        }
        return null
      })()

      if (energySource == null) {
        return null
      }
      return FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(energySource, RESOURCE_ENERGY)))
    }

    if (this.ramparts == null) {
      this.ramparts = this.calculateRampartsToRepair()
    }

    const target = ((): StructureRampart | null => {
      const rampartToRepair = this.ramparts.rampartsToRepair.shift()
      if (rampartToRepair != null) {
        return rampartToRepair
      }
      const ramparts = this.ramparts.all
      ramparts.sort((lhs, rhs) => lhs.hits - rhs.hits)
      return ramparts.shift() ?? null
    })()
    if (target == null) {
      return null
    }

    return FleeFromAttackerTask.create(MoveToTargetTask.create(RepairApiWrapper.create(target)))
  }

  private calculateRampartsToRepair(): { all: StructureRampart[], rampartsToRepair: StructureRampart[] } {
    const targetRamparts: { rampart: StructureRampart, hitsToRepair: number }[] = []

    this.defenseInfo.guardPositions.forEach(position => {
      if (position.rampartId == null) {
        return // TODO: construction siteを生成する
      }
      const rampart = Game.getObjectById(position.rampartId)
      if (rampart == null) {
        return
      }

      const hitsToRepair = position.minimumHits - rampart.hits
      targetRamparts.push({
        rampart,
        hitsToRepair,
      })
    })

    targetRamparts.sort((lhs, rhs) => lhs.hitsToRepair - rhs.hitsToRepair)

    const all = targetRamparts.map(info => info.rampart)
    const rampartsToRepair = targetRamparts.filter(info => info.hitsToRepair > 0).map(info => info.rampart)

    return {
      all,
      rampartsToRepair,
    }
  }

  private spawnRepairer(energyCapacity: number): void {
    const bodyUnit: BodyPartConstant[] = [
      CARRY, CARRY,
      WORK, WORK, WORK, WORK,
      MOVE, MOVE, MOVE,
    ]
    const body = CreepBody.create([], bodyUnit, energyCapacity, 5)

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Worker],
      body,
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }

  private addStopSpawningReason(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }

  private removeStopSpawningReason(reason: string): void {
    const index = this.stopSpawningReasons.indexOf(reason)
    if (index < 0) {
      return
    }
    this.stopSpawningReasons.splice(index, 1)
  }
}

const addNukes = (nukes: Nuke[], defenseInfo: DefenseInfo, calculateInfo: CalculateInfo): DefenseInfo => {
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
    STRUCTURE_LAB,
  ]
  const wallMinimumHits = 2000000

  nukes.forEach(nuke => {
    for (let j = -nukeDamageRange; j <= nukeDamageRange; j += 1) {
      for (let i = -nukeDamageRange; i <= nukeDamageRange; i += 1) {
        const x = nuke.pos.x + i
        const y = nuke.pos.y + j
        if (x < minGuardPosition || x > maxGuardPosition || y < minGuardPosition || y > maxGuardPosition) {
          continue
        }

        try {
          const roomPosition = new RoomPosition(x, y, nuke.pos.roomName)
          const ownedStructures = roomPosition.findInRange(FIND_MY_STRUCTURES, 0)
          const anyStructure = ownedStructures[0]
          if (anyStructure == null) {
            continue
          }

          if (ownedStructures.length <= 1 && excludedOwnedStructureTypes.includes(anyStructure.structureType) === true) {
            continue
          }

          if (ownedStructures.some(structure => calculateInfo.excludedStructureIds.includes(structure.id) === true) === true) {
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

          const range = Math.max(Math.abs(i), Math.abs(j))
          const estimatedDamage = GameConstants.nuke.damage(range)
          position.minimumHits += estimatedDamage

        } catch (error) {
          PrimitiveLogger.programError(`DefenseNukeProcess ${error}`)
          continue
        }
      }
    }
  })

  return defenseInfo
}
