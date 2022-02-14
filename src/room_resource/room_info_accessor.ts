import { decodeRoomPosition, Position } from "prototype/room_position"
import { RoomName } from "utility/room_name"
import { OwnedRoomInfo, OwnedRoomConfig } from "./room_info"

export const defaultMaxWallHits = 5000000

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

  public set wallMaxHits(value: number) {
    this.config.wallMaxHits = value
  }
  public get wallMaxHits(): number {
    return this.config.wallMaxHits ?? defaultMaxWallHits
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
  // excludedRemotes?: RoomName[]
  // waitingPosition?: { x: number, y: number }

  public addGenericWaitingPositions(positions: Position[]): void {
    if (this.config.genericWaitingPositions == null) {
      this.config.genericWaitingPositions = []
    }
    this.config.genericWaitingPositions.push(...positions)
  }
  public getAllWaitingPositions(): RoomPosition[] {
    if (this.config.genericWaitingPositions == null) {
      return []
    }
    return this.config.genericWaitingPositions.map(position => decodeRoomPosition(position, this.roomName))
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

  public enablePower(power: PowerConstant): void {
    if (this.config.powers == null) {
      this.config.powers = []
    }
    if (this.config.powers.includes(power) === true) {
      return
    }
    this.config.powers.push(power)
  }
  public disablePower(power: PowerConstant): void {
    if (this.config.powers == null) {
      return
    }
    const index = this.config.powers.indexOf(power)
    if (index < 0) {
      return
    }
    this.config.powers.splice(index, 1)
  }
  public powerEnabled(power: PowerConstant): boolean {
    if (this.config.powers == null) {
      return false
    }
    if (this.config.powers.includes(power) !== true) {
      return false
    }
    return true
  }
  public enabledPowers(): PowerConstant[] {
    if (this.config.powers == null) {
      return []
    }
    return [...this.config.powers]
  }
  public clearPower(): void {
    this.config.powers = []
  }

  public addNoRepairWallIds(wallIds: Id<StructureWall | StructureRampart>[]): void {
    if (this.config.noRepairWallIds == null) {
      this.config.noRepairWallIds = []
    }
    const noRepairWallIds = this.config.noRepairWallIds
    wallIds.forEach(wallId => {
      if (noRepairWallIds.includes(wallId) === true) {
        return
      }
      noRepairWallIds.push(wallId)
    })
  }
  public getNoRepairWallIds(): Id<StructureWall | StructureRampart>[] {
    if (this.config.noRepairWallIds == null) {
      return []
    }
    return [...this.config.noRepairWallIds]
  }

  public addBoostLabs(boostLabs: StructureLab[]): void {
    if (this.config.boostLabs == null) {
      this.config.boostLabs = []
    }
    const boostLabIds = this.config.boostLabs

    boostLabs.forEach(lab => {
      if (boostLabIds.some(labId => labId === lab.id) === true) {
        return
      }
      boostLabIds.push(lab.id)
    })
  }
  public getBoostLabs(): StructureLab[] {
    if (this.config.boostLabs == null) {
      return []
    }
    return this.config.boostLabs.flatMap((labId): StructureLab[] => {
      const lab = Game.getObjectById(labId)
      if (lab == null) {
        return []
      }
      return [lab]
    })
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
