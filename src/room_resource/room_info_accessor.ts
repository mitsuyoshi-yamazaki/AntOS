import { Position } from "prototype/room_position"
import { RoomName } from "utility/room_name"
import { OwnedRoomInfo, OwnedRoomConfig } from "./room_info"

class Config {
  public set disablePowerHarvesting(value: boolean) {
    this.config.disablePowerHarvesting = value
  }
  public get disablePowerHarvesting(): boolean {
    return this.config.disablePowerHarvesting ?? false
  }

  public set disableMineralHarvesting(value: boolean) {
    this.config.disableMineralHarvesting = value
  }
  public get disableMineralHarvesting(): boolean {
    return this.config.disableMineralHarvesting ?? false
  }

  public set disableUnnecessaryTasks(value: boolean) {
    this.config.disableUnnecessaryTasks = value
  }
  public get disableUnnecessaryTasks(): boolean {
    return this.config.disableUnnecessaryTasks ?? false
  }

  public set enableOperateSpawn(value: boolean) {
    this.config.enableOperateSpawn = value
  }
  public get enableOperateSpawn(): boolean {
    return this.config.enableOperateSpawn ?? false
  }

  public set collectResources(value: boolean) {
    this.config.collectResources = value
  }
  public get collectResources(): boolean {
    return this.config.collectResources ?? false
  }

  public set enableAutoAttack(value: boolean) {
    this.config.enableAutoAttack = value
  }
  public get enableAutoAttack(): boolean {
    return this.config.enableAutoAttack ?? false
  }

  public set mineralMaxAmount(value: number) {
    this.config.mineralMaxAmount = value
  }
  public get mineralMaxAmount(): number {
    return this.config.mineralMaxAmount ?? 100000
  }

  public set constructionInterval(value: number) {
    this.config.constructionInterval = value
  }
  public get constructionInterval(): number {
    return this.config.constructionInterval ?? 17
  }

  public set concurrentConstructionSites(value: number) {
    this.config.concurrentConstructionSites = value
  }
  public get concurrentConstructionSites(): number {
    return this.config.concurrentConstructionSites ?? 1
  }

  private config: OwnedRoomConfig

  public constructor(
    private readonly roomName: RoomName,
    roomInfo: OwnedRoomInfo,
  ) {
    if (roomInfo.config == null) {
      roomInfo.config = {}
    }
    this.config = roomInfo.config
  }

  // researchCompounds?: { [index in MineralCompoundConstant]?: number }
  // boostLabs?: Id<StructureLab>[]
  // excludedRemotes?: RoomName[]
  // waitingPosition?: { x: number, y: number }
  // noRepairWallIds?: Id<StructureWall | StructureRampart>[]

  public addGenericWaitingPositions(positions: Position[]): void {
    if (this.config.genericWaitingPositions == null) {
      this.config.genericWaitingPositions = []
    }
    this.config.genericWaitingPositions.push(...positions)
  }
  public getGenericWaitingPosition(): RoomPosition | null {
    if (this.config.genericWaitingPositions == null) {
      return null
    }
    const position = this.config.genericWaitingPositions[Game.time % this.config.genericWaitingPositions.length]
    if (position == null) {
      return null
    }
    try {
      return new RoomPosition(position.x, position.y, this.roomName)
    } catch {
      return null
    }
  }
}

export class OwnedRoomInfoAccessor {
  public readonly config: Config

  public constructor(
    public readonly roomName: RoomName,
    public readonly roomInfo: OwnedRoomInfo,
  ) {
    this.config = new Config(roomName, roomInfo)
  }
}
