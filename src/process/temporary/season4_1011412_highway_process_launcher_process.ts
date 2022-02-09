import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import type { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { KeywordArguments } from "os/infrastructure/console_command/utility/keyword_argument_parser"
import type { Timestamp } from "utility/timestamp"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Position, RoomPositionFilteringOptions } from "prototype/room_position"
import { OperatingSystem } from "os/os"
import { Season4964954HarvestPowerProcess } from "./season4_964954_harvest_power_process"
import { Season4275982HarvestCommodityProcess } from "./season4_275982_harvest_commodity_process"
import { GameMap } from "game/game_map"

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
  readonly powerAmount: number
  readonly position: Position
}
type DepositTargetInfo = {
  readonly case: "deposit"
  readonly roomName: RoomName
  readonly targetId: Id<Deposit>
  readonly ignoreReasons: string[]
  readonly neighbourCount: number
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
    }
  }

  public static decode(state: Season41011412HighwayProcessLauncherProcessState): Season41011412HighwayProcessLauncherProcess {
    return new Season41011412HighwayProcessLauncherProcess(
      state.l,
      state.i,
      state.bases,
      state.observeResults,
      state.stopLaunchingReasons,
    )
  }

  public static create(processId: ProcessId): Season41011412HighwayProcessLauncherProcess {
    return new Season41011412HighwayProcessLauncherProcess(Game.time, processId, [], {}, [])
  }

  public processShortDescription(): string {
    return "not implemented yet"  // TODO:
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "add":
        return this.addBase(components)
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  /** @throws */
  private addBase(args: string[]): string {
    const keywordArguments = new KeywordArguments(args)
    const roomResource = keywordArguments.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    const observer = roomResource.activeStructures.observer
    if (observer == null) {
      throw `no observer in ${roomLink(roomName)}`
    }

    const targetRoomNames = keywordArguments.roomNameList("target_room_names").parse()
    if (targetRoomNames.length <= 0) {
      throw "target_room_names has 0 length"
    }
    const targetingBases = this.bases.flatMap(base => base.targetRoomNames.some(targetRoomName => targetRoomNames.includes(targetRoomName) === true) === true)
    if (targetingBases.length > 0) {
      throw "targets duplicated"
    }

    if (this.bases.some(base => base.roomName === roomName) === true) {
      throw `${roomLink(roomName)} is already in the list`
    }

    this.bases.push({
      roomName,
      observerId: observer.id,
      targetRoomNames,
      observeIndex: 0,
    })

    return `${roomLink(roomName)}: ${targetRoomNames.map(targetRoomName => roomLink(targetRoomName)).join(",")}`
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
      ignoreReasons.push(`lack of empty space (${neighbourCount})`)
    }
    if (powerBank.power < 3000) {
      ignoreReasons.push(`power too little (${powerBank.power})`)
    }

    return {
      case: "power bank",
      roomName: powerBank.room.name,
      targetId: powerBank.id,
      ignoreReasons,
      neighbourCount,
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
      commodityType: deposit.depositType,
      currentCooldown: deposit.lastCooldown,
    }
  }

  private launchProcess(): void {
    const harvestPowerBankCost = 10
    const harvestCommodityCost = 6
    const maxCost = 15
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

    this.bases.forEach(base => {
      const observeResult = this.observeResults[base.roomName]
      if (observeResult == null) {
        return
      }

      const spawnCost = baseSpawnTimeCost.get(base.roomName) ?? 0
      if (spawnCost > maxCost) {
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

        this.launchHarvestProcess(target, base.roomName)
        break
      }
    })
  }

  private launchHarvestProcess(target: TargetInfo, parentRoomName: RoomName): void {
    target.ignoreReasons.push("harvesting")
    const waypoints = GameMap.getWaypoints(parentRoomName, target.roomName) ?? []

    switch (target.case) {
    case "power bank": {
      const powerBankInfo = {
        id: target.targetId,
        powerAmount: target.powerAmount,
        position: target.position,
        neighbourCount: target.neighbourCount,
      }
      OperatingSystem.os.addProcess(null, processId => Season4964954HarvestPowerProcess.create(processId, parentRoomName, target.roomName, waypoints, powerBankInfo))
      return
    }
    case "deposit": {
      const depositInfo = {
        roomName: target.roomName,
        depositId: target.targetId,
        commodityType: target.commodityType,
        neighbourCellCount: target.neighbourCount,
        currentCooldown: target.currentCooldown,
      }
      const creepSpec = {
        harvesterCount: target.neighbourCount >= 2 ? 2 : 1,
        haulerCount: 1,
      }
      OperatingSystem.os.addProcess(null, processId => Season4275982HarvestCommodityProcess.create(processId, parentRoomName, depositInfo, creepSpec))
      return
    }
    }
  }
}
