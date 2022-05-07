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
  // private rampartsToRepair: (ConstructionSite<STRUCTURE_RAMPART> | StructureRampart)[] = []
  private ramparts: { all: StructureRampart[], rampartsToRepair: StructureRampart[] } | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private defenseInfo: DefenseInfo,
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
    const commandList = ["help", "status", "show_visual", "recalculate"]
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

      case "recalculate":
        return this.recalculate()

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private recalculate(): string {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      throw `no visible for ${roomLink(this.roomName)}`
    }

    const nukes = room.find(FIND_NUKES)
    this.defenseInfo = addNukes(nukes, { guardPositions: [], nukes: [] })

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

    const shouldSpawn = ((): boolean => {
      const creepMaxCount = 3
      const creepCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)

      if (creepCount >= creepMaxCount) {
        return false
      }

      if (roomResource.getResourceAmount(RESOURCE_ENERGY) < 20000) {
        return false
      }

      this.ramparts = this.calculateRampartsToRepair()
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
      return this.ramparts.all.shift() ?? null
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

    targetRamparts.sort((lhs, rhs) => rhs.hitsToRepair - lhs.hitsToRepair)

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
