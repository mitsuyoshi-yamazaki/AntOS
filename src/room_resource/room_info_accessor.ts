import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeRoomPosition, Position } from "prototype/room_position"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { Result } from "utility/result"
import { RoomName } from "utility/room_name"
import { OwnedRoomInfo, OwnedRoomConfig, BoostLabInfo } from "./room_info"

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
}

export class OwnedRoomInfoAccessor {
  public readonly config: Config
  public readonly roomName: RoomName

  public constructor(
    private readonly room: Room,
    public readonly roomInfo: OwnedRoomInfo,
  ) {
    this.roomName = room.name
    this.config = new Config(this.roomName, roomInfo)

    if (this.roomInfo.boostLabs == null) {
      this.roomInfo.boostLabs = []  // FixMe: Migration
    }
  }

  public addBoosts(boosts: MineralBoostConstant[]): Result<{newBoostLabs: BoostLabInfo[], removedFromResearchOutputLabs: StructureLab[]}, string> {
    try {
      this.roomInfo.boostLabs.forEach(boostLabInfo => {
        if (boosts.includes(boostLabInfo.boost) === true) {
          throw `${coloredResourceType(boostLabInfo.boost)} is already in the list ${roomLink(this.roomName)}`
        }
      })

      const unassignedLabs = this.unassignedLabs()
      const researchOutputLabs = this.researchOutputLabs()
      const assignableLabCount = unassignedLabs.length + researchOutputLabs.length

      const assignableLabs: StructureLab[] = [
        ...unassignedLabs,
        ...researchOutputLabs,
      ]

      const newBoostLabs: {lab: StructureLab, boost: MineralBoostConstant}[] = []
      boosts.forEach((boost, index) => {
        const lab = assignableLabs[index]
        if (lab == null) {
          throw `lack of available labs. assignable lab count: ${assignableLabCount} > ${boosts.length} boosts`
        }
        newBoostLabs.push({
          boost,
          lab,
        })
      })

      const removedFromResearchOutputLabs: StructureLab[] = []
      if (this.roomInfo.researchLab != null) {
        const researchOutputLabs = this.roomInfo.researchLab.outputLabs
        newBoostLabs.forEach(labInfo => {
          const outputLabIndex = researchOutputLabs.indexOf(labInfo.lab.id)
          if (outputLabIndex < 0) {
            return
          }
          researchOutputLabs.splice(outputLabIndex, 1)
          removedFromResearchOutputLabs.push(labInfo.lab)
        })
      }

      this.roomInfo.boostLabs.push(...newBoostLabs.map(labInfo => ({ labId: labInfo.lab.id, boost: labInfo.boost})))

      return Result.Succeeded({
        newBoostLabs: newBoostLabs.map(labInfo => ({ boost: labInfo.boost, labId: labInfo.lab.id })),
        removedFromResearchOutputLabs,
      })
    } catch (error) {
      return Result.Failed(`${error}`)
    }
  }
  public removeBoosts(boosts: MineralBoostConstant[]): Result<{ addedToResearchOutputLabIds: Id<StructureLab>[] }, string> {
    try {
      this.roomInfo.boostLabs.forEach(boostLabInfo => {
        if (boosts.includes(boostLabInfo.boost) !== true) {
          throw `${coloredResourceType(boostLabInfo.boost)} is not in the list ${roomLink(this.roomName)}`
        }
      })

      const addedToResearchOutputLabIds: Id<StructureLab>[] = []
      boosts.forEach(boost => {
        const boostLabInfo = this.roomInfo.boostLabs
          .map((labInfo, index) => ({ labId: labInfo.labId, boost: labInfo.boost, index }))
          .find(labInfo => labInfo.boost === boost)
        if (boostLabInfo == null) {
          return
        }
        this.roomInfo.boostLabs.splice(boostLabInfo.index, 1)
        addedToResearchOutputLabIds.push(boostLabInfo.labId)
      })

      return Result.Succeeded({ addedToResearchOutputLabIds })

    } catch (error) {
      return Result.Failed(`${error}`)
    }
  }
  public removeAllBoosts(): { addedToResearchOutputLabIds: Id<StructureLab>[], removedBoosts: MineralBoostConstant[] } {
    const addedToResearchOutputLabIds: Id<StructureLab>[] = []
    const removedBoosts: MineralBoostConstant[] = this.roomInfo.boostLabs.map(labInfo => labInfo.boost)

    if (this.roomInfo.researchLab != null) {
      const labIds = this.roomInfo.boostLabs.map(labInfo => labInfo.labId)
      this.roomInfo.researchLab.outputLabs.push(...labIds)
      addedToResearchOutputLabIds.push(...labIds)
    }
    return {
      addedToResearchOutputLabIds,
      removedBoosts,
    }
  }
  public getBoostLabs(): BoostLabInfo[] {
    return [...this.roomInfo.boostLabs]
  }

  private researchOutputLabs(): StructureLab[] {
    if (this.roomInfo.researchLab == null) {
      return []
    }
    return [
      ...this.roomInfo.researchLab.outputLabs.flatMap((labId): StructureLab[] => {
        const lab = Game.getObjectById(labId)
        if (lab == null) {
          return []
        }
        return [lab]
      })
    ]
  }

  private unassignedLabs(): StructureLab[] {
    const assignedLabIds: Id<StructureLab>[] = [
      ...this.roomInfo.boostLabs.map(labInfo => labInfo.labId)
    ]
    const researchLab = this.roomInfo.researchLab
    if (researchLab != null) {
      assignedLabIds.push(researchLab.inputLab1)
      assignedLabIds.push(researchLab.inputLab2)
      assignedLabIds.push(...researchLab.outputLabs)
    }

    return (this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[])
      .filter(lab => assignedLabIds.includes(lab.id) !== true)
  }
}
