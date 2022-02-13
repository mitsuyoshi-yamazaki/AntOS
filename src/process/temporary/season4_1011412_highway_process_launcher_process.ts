import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import type { RoomName } from "utility/room_name"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import type { Timestamp } from "utility/timestamp"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Position, RoomPositionFilteringOptions } from "prototype/room_position"
import { OperatingSystem } from "os/os"
import { Season4964954HarvestPowerProcess } from "./season4_964954_harvest_power_process"
import { Season4275982HarvestCommodityProcess } from "./season4_275982_harvest_commodity_process"
import { GameMap } from "game/game_map"
import { RoomResources } from "room_resource/room_resources"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"

ProcessDecoder.register("Season41011412HighwayProcessLauncherProcess", state => {
  return Season41011412HighwayProcessLauncherProcess.decode(state as Season41011412HighwayProcessLauncherProcessState)
})

type BaseInfo = {
  readonly roomName: RoomName
  readonly observerId: Id<StructureObserver>
  readonly targetRoomNames: RoomName[]
  observeIndex: number
}

type TargetType = StructurePowerBank | Deposit

type PowerBankTargetInfo = {
  readonly case: "power bank"
  readonly roomName: RoomName
  readonly targetId: Id<StructurePowerBank>
  readonly ignoreReasons: string[]
  readonly neighbourCount: number
  readonly decayBy: Timestamp
  readonly powerAmount: number
  readonly position: Position
}
type DepositTargetInfo = {
  readonly case: "deposit"
  readonly roomName: RoomName
  readonly targetId: Id<Deposit>
  readonly ignoreReasons: string[]
  readonly neighbourCount: number
  readonly decayBy: Timestamp
  readonly commodityType: DepositConstant
  readonly currentCooldown: number
}
type TargetInfo = PowerBankTargetInfo | DepositTargetInfo

type ObserveResult = {
  readonly roomName: RoomName
  observedAt: Timestamp
  readonly targets: TargetInfo[]
}

interface Season41011412HighwayProcessLauncherProcessState extends ProcessState {
  readonly bases: BaseInfo[]
  readonly observeResults: { [roomName: string]: ObserveResult }
  readonly stopLaunchingReasons: string[]
  readonly maxProcessCount: number
  readonly storageRooms: {[roomName: string]: RoomName}
}

export class Season41011412HighwayProcessLauncherProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly bases: BaseInfo[],
    private readonly observeResults: { [roomName: string]: ObserveResult},
    private readonly stopLaunchingReasons: string[],
    private maxProcessCount: number,
    private readonly storageRooms: { [roomName: string]: RoomName },
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): Season41011412HighwayProcessLauncherProcessState {
    return {
      t: "Season41011412HighwayProcessLauncherProcess",
      l: this.launchTime,
      i: this.processId,
      bases: this.bases,
      observeResults: this.observeResults,
      stopLaunchingReasons: this.stopLaunchingReasons,
      maxProcessCount: this.maxProcessCount,
      storageRooms: this.storageRooms,
    }
  }

  public static decode(state: Season41011412HighwayProcessLauncherProcessState): Season41011412HighwayProcessLauncherProcess {
    return new Season41011412HighwayProcessLauncherProcess(
      state.l,
      state.i,
      state.bases,
      state.observeResults,
      state.stopLaunchingReasons,
      state.maxProcessCount ?? 10,  // FixMe: Migration
      state.storageRooms ?? {}, // FixMe: Migration
    )
  }

  public static create(processId: ProcessId): Season41011412HighwayProcessLauncherProcess {
    return new Season41011412HighwayProcessLauncherProcess(Game.time, processId, [], {}, [], 10, {})
  }

  public processShortDescription(): string {
    return `watching ${this.bases.map(base => roomLink(base.roomName)).join(",")}`
  }

  public processDescription(): string {
    try {
      const descriptions: string[] = [
        `- ${this.bases.length} bases (max process count: ${this.maxProcessCount})`,
        ...this.bases.flatMap(base => this.baseInfo(base.roomName)),
      ]

      return descriptions.join("\n")
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add", "show", "set_max_process_count", "add_storage_rooms"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "add":
        return this.addBase(components)
      case "remove":
        return this.remove(components)
      case "show": {
        const listArguments = new ListArguments(components)
        if (listArguments.has(0) === true) {
          const baseRoomName = listArguments.roomName(0, "room name").parse({ my: true })
          return this.baseInfo(baseRoomName)
        }
        return this.processDescription()
      }
      case "set_max_process_count": {
        const listArguments = new ListArguments(components)
        const maxProcessCount = listArguments.int(0, "max process count").parse({ min: 0 })
        const oldValue = this.maxProcessCount
        this.maxProcessCount = maxProcessCount
        return `max process count set ${this.maxProcessCount} (from ${oldValue})`
      }
      case "add_storage_rooms":
        return this.addStorageRooms(components)
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  /** @throws */
  private addStorageRooms(args: string[]): string {
    const listArguments = new ListArguments(args)
    const storageRoomResource = listArguments.ownedRoomResource(0, "storage room name").parse()
    const storageRoomName = storageRoomResource.room.name
    if (storageRoomResource.activeStructures.storage == null) {
      throw `${roomLink(storageRoomName)} has no storage`
    }
    const targetRoomNames = listArguments.roomNameList(1, "target room names").parse()

    const allTargetRoomnames = this.bases.flatMap(base => base.targetRoomNames)
    targetRoomNames.forEach(targetRoomName => {
      if (allTargetRoomnames.includes(targetRoomName) === true) {
        return
      }
      throw `${roomLink(targetRoomName)} is not in the target list`
    })

    targetRoomNames.forEach(targetRoomName => (this.storageRooms[targetRoomName] = storageRoomName))
    return `storage room ${roomLink(storageRoomName)} set for ${targetRoomNames.map(targetRoomName => roomLink(targetRoomName)).join(",")}`
  }

  /** @throws */
  private baseInfo(baseRoomName: RoomName): string {
    const base = this.bases.find(b => b.roomName === baseRoomName)
    if (base == null) {
      throw `${roomLink(baseRoomName)} is not in the list`
    }

    const targetDescription = (target: TargetInfo): string[] => {
      switch (target.case) {
      case "power bank":
        return [
          `  - ${coloredResourceType(RESOURCE_POWER)} in ${roomLink(target.roomName)}, amount: ${target.powerAmount}, decay: ${target.decayBy - Game.time}`,
          ...target.ignoreReasons.map(reason => `    - ${reason}`)
        ]
      case "deposit":
        return [
          `  - ${coloredResourceType(target.commodityType)} in ${roomLink(target.roomName)}, cooldown: ${target.currentCooldown}, decay: ${target.decayBy - Game.time}`,
          ...target.ignoreReasons.map(reason => `    - ${reason}`)
        ]
      }
    }

    const observeResultsDesctiptions = (observeTargetRoomName: RoomName): string[] => {
      const observeResults = this.observeResults[observeTargetRoomName]
      if (observeResults == null) {
        return [`- nothing in ${roomLink(observeTargetRoomName)}`]
      }

      return [
        `- ${roomLink(observeTargetRoomName)}: observed at ${Game.time - observeResults.observedAt} ticks ago`,
        ...observeResults.targets.flatMap(target => targetDescription(target)),
      ]
    }

    const descriptions: string[] = [
      `- ${roomLink(base.roomName)}:`,
      `  - targets: ${base.targetRoomNames.map(targetRoomName => roomLink(targetRoomName)).join(",")}`,
      ...base.targetRoomNames.flatMap(targetRoomName => observeResultsDesctiptions(targetRoomName)),
    ]

    return descriptions.join("\n")
  }

  /** @throws */
  private addBase(args: string[]): string {
    const listArguments = new ListArguments(args)
    const roomResource = listArguments.ownedRoomResource(0, "room name").parse()
    const roomName = roomResource.room.name
    const observer = roomResource.activeStructures.observer
    if (observer == null) {
      throw `no observer in ${roomLink(roomName)}`
    }

    const targetRoomNames = listArguments.roomNameList(1, "target room names").parse()
    if (targetRoomNames.length <= 0) {
      throw "target_room_names has 0 length"
    }
    const targetingBases = this.bases.filter(base => base.targetRoomNames.some(targetRoomName => targetRoomNames.includes(targetRoomName) === true) === true)
    if (targetingBases.length > 0) {
      throw "targets duplicated"
    }

    const targetBase = this.bases.find(base => base.roomName === roomName)
    if (targetBase != null) {
      targetBase.targetRoomNames.push(...targetRoomNames)
      return `${targetRoomNames.length} target rooms added to ${roomLink(targetBase.roomName)} (${targetRoomNames.map(targetRoomName => roomLink(targetRoomName)).join(",")}`
    }

    this.bases.push({
      roomName,
      observerId: observer.id,
      targetRoomNames,
      observeIndex: 0,
    })

    return `${roomLink(roomName)}: ${targetRoomNames.map(targetRoomName => roomLink(targetRoomName)).join(",")}`
  }

  /** @throws */
  private remove(args: string[]): string {
    const listArguments = new ListArguments(args)
    const roomNames = listArguments.roomNameList(0, "room names").parse()
    if (roomNames.length <= 0) {
      throw "no room names given"
    }
    if (roomNames.length === 1 && roomNames[0] != null) {
      const roomName = roomNames[0]
      const index = this.bases.findIndex(base => base.roomName === roomName)
      if (index >= 0) {
        this.bases.splice(index, 1)
        return `base ${roomLink(roomName)} removed`
      }
    }

    const removedRoomNames: RoomName[] = []
    roomNames.forEach(roomName => {
      for (const base of this.bases) {
        const index = base.targetRoomNames.indexOf(roomName)
        if (index >= 0) {
          base.targetRoomNames.splice(index, 1)
          removedRoomNames.push(roomName)
          break
        }
      }
    })

    return `${removedRoomNames.length} target rooms removed: ${removedRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  }

  public runOnTick(): void {
    if (this.bases.length <= 0) {
      return
    }

    const timestamp = (Game.time % 9)
    switch (timestamp) {
    case 0: // reserve observation cycle
      this.reserveObservation()
      return
    case 1: // observe cycle
      this.observe()
      this.launchProcess()
      return
    default:
      return
    }
  }

  private reserveObservation(): void {
    this.bases.forEach(base => {
      const observer = Game.getObjectById(base.observerId)
      if (observer == null) {
        return
      }
      base.observeIndex = (base.observeIndex + 1) % base.targetRoomNames.length
      const targetRoomName = base.targetRoomNames[base.observeIndex]

      if (targetRoomName == null) {
        PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} targetRoomNames[${base.observeIndex}] returns undefined (target rooms: ${base.targetRoomNames.join(",")})`)
        return
      }

      observer.observeRoom(targetRoomName)
    })
  }

  private observe(): void {
    this.bases.forEach(base => {
      base.targetRoomNames.forEach(targetRoomName => {
        const targetRoom = Game.rooms[targetRoomName]
        if (targetRoom == null) {
          return
        }

        const observeResult = ((): ObserveResult => {
          const stored = this.observeResults[targetRoomName]
          if (stored != null) {
            return stored
          }
          const newValue: ObserveResult = {
            roomName: targetRoomName,
            observedAt: Game.time,
            targets: [],
          }
          this.observeResults[targetRoomName] = newValue
          return newValue
        })()

        observeResult.observedAt = Game.time

        const removeIndices: number[] = []
        observeResult.targets.forEach((target, index) => {
          if (Game.getObjectById(target.targetId) == null) {
            removeIndices.push(index)
          }
        })
        removeIndices.reverse()
        removeIndices.forEach(index => observeResult.targets.splice(index, 1))

        const storedTargetIds = observeResult.targets.map(target => target.targetId)
        const targetObjects = this.targetsInRoom(targetRoom)
        const newTargets = targetObjects.flatMap((target): TargetInfo[] => {
          if (storedTargetIds.includes(target.id) === true) {
            return []
          }
          return [this.makeTargetInfo(target)]
        })

        observeResult.targets.push(...newTargets)
      })
    })
  }

  private targetsInRoom(targetRoom: Room): TargetType[] {
    const results: TargetType[] = [
      ...(targetRoom.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK } }) as StructurePowerBank[]),
      ...targetRoom.find(FIND_DEPOSITS)
    ]
    return results
  }

  private makeTargetInfo(target: TargetType): TargetInfo {
    if (target instanceof StructurePowerBank) {
      return this.makePowerBankTargetInfo(target)
    }
    return this.makeDepositTargetInfo(target)
  }

  private makePowerBankTargetInfo(powerBank: StructurePowerBank): PowerBankTargetInfo {
    const filteringOptions: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeWalkableStructures: false,
      excludeTerrainWalls: true,
    }
    const neighbourCount = powerBank.pos.positionsInRange(1, filteringOptions).length
    const ignoreReasons: string[] = []

    if (neighbourCount < 3) {
      // if (powerBank.power < 4000) {
      ignoreReasons.push(`lack of empty space ${neighbourCount} and power ${powerBank.power}`)
      // } else {
      //   // launch boosted
      // }
    }
    if (powerBank.power < 2500) {
      ignoreReasons.push(`power too little (${powerBank.power})`)
    }

    return {
      case: "power bank",
      roomName: powerBank.room.name,
      targetId: powerBank.id,
      ignoreReasons,
      neighbourCount,
      decayBy: powerBank.ticksToDecay + Game.time,
      powerAmount: powerBank.power,
      position: {x: powerBank.pos.x, y: powerBank.pos.y}
    }
  }

  private makeDepositTargetInfo(deposit: Deposit): DepositTargetInfo {
    const filteringOptions: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeWalkableStructures: false,
      excludeTerrainWalls: true,
    }
    const neighbourCount = deposit.pos.positionsInRange(1, filteringOptions).length
    const ignoreReasons: string[] = []

    if (deposit.lastCooldown > 15) {
      ignoreReasons.push(`too long cooldown (${deposit.lastCooldown})`)
    }

    return {
      case: "deposit",
      roomName: deposit.pos.roomName,
      targetId: deposit.id,
      ignoreReasons,
      neighbourCount,
      decayBy: deposit.ticksToDecay + Game.time,
      commodityType: deposit.depositType,
      currentCooldown: deposit.lastCooldown,
    }
  }

  private launchProcess(): void {
    if (Game.cpu.bucket < 9000) {
      return
    }

    const minimumEnergyAmount = 50000

    const harvestPowerBankCost = 10
    const harvestCommodityCost = 6
    const maxCost = 17
    const baseSpawnTimeCost = new Map<RoomName, number>()
    const runningHarvestProcessTargetIds: Id<TargetType>[] = []

    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      const process = processInfo.process
      if (process instanceof Season4964954HarvestPowerProcess) {
        runningHarvestProcessTargetIds.push(process.powerBankInfo.id)
        const roomName = process.parentRoomName
        const cost = (baseSpawnTimeCost.get(roomName) ?? 0) + harvestPowerBankCost
        baseSpawnTimeCost.set(roomName, cost)
        return
      }
      if (process instanceof Season4275982HarvestCommodityProcess) {
        runningHarvestProcessTargetIds.push(process.depositInfo.depositId)
        const roomName = process.parentRoomName
        const cost = (baseSpawnTimeCost.get(roomName) ?? 0) + harvestCommodityCost
        baseSpawnTimeCost.set(roomName, cost)
        return
      }
      return
    })

    let launchableProcessCount = this.maxProcessCount - runningHarvestProcessTargetIds.length
    if (launchableProcessCount <= 0) {
      return
    }

    this.bases.forEach(base => {
      let launched = false as boolean
      if (launchableProcessCount <= 0) {
        return
      }

      const spawnCost = baseSpawnTimeCost.get(base.roomName) ?? 0
      if (spawnCost > maxCost) {
        return
      }

      base.targetRoomNames.forEach(targetRoomName => {
        if (launched === true) {
          return
        }
        const observeResult = this.observeResults[targetRoomName]
        if (observeResult == null) {
          return
        }

        const roomResource = RoomResources.getOwnedRoomResource(base.roomName)
        if (roomResource == null || roomResource.getResourceAmount(RESOURCE_ENERGY) < minimumEnergyAmount) {
          return
        }

        for (const target of observeResult.targets) {
          if (target.ignoreReasons.length > 0) {
            continue
          }
          if (runningHarvestProcessTargetIds.includes(target.targetId) === true) {
            target.ignoreReasons.push("harvesting")
            continue
          }
          if ((target.decayBy - Game.time) < 2500) {
            target.ignoreReasons.push("decaying")
            continue
          }

          this.launchHarvestProcess(target, base.roomName)
          launched = true
          launchableProcessCount -= 1
          break
        }
      })
    })
  }

  private launchHarvestProcess(target: TargetInfo, parentRoomName: RoomName): void {
    target.ignoreReasons.push("harvesting")

    switch (target.case) {
    case "power bank":
      this.launchHarvestPowerProcess(target, parentRoomName)
      return
    case "deposit":
      this.launchHarvestDepositProcess(target, parentRoomName)
      return
    }
  }

  private launchHarvestPowerProcess(target: PowerBankTargetInfo, parentRoomName: RoomName): void {
    const powerBankInfo = {
      id: target.targetId,
      powerAmount: target.powerAmount,
      position: target.position,
      neighbourCount: target.neighbourCount,
    }

    const waypoints = GameMap.getWaypoints(parentRoomName, target.roomName) ?? []
    const shouldBoost = ((): boolean => {
      if (powerBankInfo.neighbourCount >= 3) {
        return false
      }
      return false  // TODO:
    })()

    const process = OperatingSystem.os.addProcess(null, processId => Season4964954HarvestPowerProcess.create(processId, parentRoomName, target.roomName, waypoints, powerBankInfo))
    Memory.os.logger.filteringProcessIds.push(process.processId)

    const storageRoomName = this.storageRooms[target.roomName]
    if (storageRoomName != null) {
      process.setStorageRoomName(storageRoomName)
    }
  }

  private launchHarvestDepositProcess(target: DepositTargetInfo, parentRoomName: RoomName): void {
    const depositInfo = {
      roomName: target.roomName,
      depositId: target.targetId,
      commodityType: target.commodityType,
      neighbourCellCount: target.neighbourCount,
      currentCooldown: target.currentCooldown,
    }
    const creepSpec = {
      harvesterCount: target.neighbourCount >= 2 ? 2 : 1,
      haulerCount: Game.map.getRoomLinearDistance(parentRoomName, target.roomName) >= 4 ? 2 : 1,
    }
    const process = OperatingSystem.os.addProcess(null, processId => Season4275982HarvestCommodityProcess.create(processId, parentRoomName, depositInfo, creepSpec))

    const storageRoomName = this.storageRooms[target.roomName]
    if (storageRoomName != null) {
      process.setStorageRoomName(storageRoomName)
    }
  }
}
