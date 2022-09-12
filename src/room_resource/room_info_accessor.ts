import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeRoomPosition, Position } from "prototype/room_position"
import { coloredResourceType, roomLink } from "utility/log"
import { MineralCompoundIngredients } from "shared/utility/resource"
import { Result } from "shared/utility/result"
import type { RoomName } from "shared/utility/room_name_types"
import { OwnedRoomInfo, OwnedRoomConfig, BoostLabInfo } from "./room_info"
import { BoostLabChargerProcessLauncher } from "process/process/boost_lab_charger_process_launcher"

export const defaultMaxWallHits = 10000000

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

  public get nonHidableRampartIds(): Id<StructureRampart>[] {
    if (this.config.nonHidableRampartIds == null) {
      this.config.nonHidableRampartIds = []
    }
    return this.config.nonHidableRampartIds
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
  public removeNoRepairWallIds(): void {
    this.config.noRepairWallIds = []
  }

  public addResearchCompounds(compound: MineralCompoundConstant, amount: number): void {
    if (this.config?.researchCompounds == null) {
      this.config.researchCompounds = {}
    }

    const stored = this.config.researchCompounds[compound]
    if (stored != null) {
      this.config.researchCompounds[compound] = stored + amount
    } else {
      this.config.researchCompounds[compound] = amount
    }
  }
  public researchingCompounds(): MineralCompoundConstant[] {
    if (this.config.researchCompounds == null) {
      return []
    }
    return Array.from(Object.keys(this.config.researchCompounds)) as MineralCompoundConstant[]
  }

  /// see: OwnedRoomInfoAccessor.evacuateDestination()
  public evacuationDestinations(): RoomName[] {
    if (this.config.evacuationDestinations == null) {
      return []
    }
    return [...this.config.evacuationDestinations]
  }
}

type LinkInfo = {
  readonly core: StructureLink | null
  readonly upgrader: StructureLink | null
  readonly sources: Map<Id<Source>, StructureLink>
}
type BoostLab = {
  readonly lab: StructureLab
  readonly boost: MineralBoostConstant
  readonly requredAmount: number
}
type ResearchLabInfo = {
  readonly inputLab1: StructureLab
  readonly inputLab2: StructureLab
  readonly outputLabs: StructureLab[]
}

type SourceEnergyTransferHauler = {
  case: "hauler"
}
type SourceEnergyTransferLink = {
  case: "link"
  readonly sourceLinks: Map<Id<Source>, StructureLink>
}
type SourceEnergyTransferType = SourceEnergyTransferHauler | SourceEnergyTransferLink

/**
 * 寿命は1tick
 */
export class OwnedRoomInfoAccessor {
  public readonly config: Config
  public readonly roomName: RoomName

  public get links(): LinkInfo {
    if (this._links == null) {
      this._links = this.parseLinks()
    }
    return this._links
  }
  public get boostLabs(): BoostLab[] {
    if (this._boostLabs == null) {
      this._boostLabs = this.getBoostLabInstances()
    }
    return this._boostLabs
  }
  public get researchLabs(): ResearchLabInfo | null {
    if (this._researchLabs === "uninitialized") {
      this._researchLabs = this.getResearchLabs()
    }
    return this._researchLabs
  }
  public get sourceEnergyTransferType(): SourceEnergyTransferType {
    return this._sourceEnergyTransferType
  }

  private _links: LinkInfo | null = null
  private _boostLabs: BoostLab[] | null = null
  private _researchLabs: ResearchLabInfo | null | "uninitialized" = "uninitialized"
  private _sourceEnergyTransferType: SourceEnergyTransferType

  public constructor(
    private readonly room: Room,
    public readonly roomInfo: OwnedRoomInfo,
    controller: StructureController,
    sources: Source[],
    private readonly mineralType: MineralConstant | null,
  ) {
    this.roomName = room.name
    this.config = new Config(this.roomName, roomInfo);

    ((): void => {
      if (controller.level < 8) { // TODO: RCL7でLinkが建つが、Link間のエネルギー送信の処理が作られていない
        this._sourceEnergyTransferType = {
          case: "hauler",
        }
        return
      }
      // if (this.roomInfo.ownedRoomType.case !== "minimum-cpu-use") {  // 通常の部屋もRCL8であれば15e/tickであるはず
      //   this._sourceEnergyTransferType = {
      //     case: "hauler",
      //   }
      //   return
      // }
      if (sources.length < 2) { // エネルギー産出が不足するため
        this._sourceEnergyTransferType = {
          case: "hauler",
        }
        return
      }
      if (sources.length !== Array.from(this.links.sources.values()).length) {
        this._sourceEnergyTransferType = {
          case: "hauler",
        }
        return
      }
      this._sourceEnergyTransferType = {
        case: "link",
        sourceLinks: new Map(this.links.sources),
      }
    })()
  }

  /**
   * @param boosts 数量未定の場合は0を入れる
   */
  public addBoosts(boostInfo: Map<MineralBoostConstant, number>): Result<{newBoostLabs: BoostLabInfo[], removedFromResearchOutputLabs: StructureLab[]}, string> {
    try {
      this.roomInfo.boostLabs.forEach(boostLabInfo => {
        const requiredAmount = boostInfo.get(boostLabInfo.boost)
        if (requiredAmount == null) {
          return
        }
        boostLabInfo.requiredAmount += requiredAmount
        boostInfo.delete(boostLabInfo.boost)
      })

      if (boostInfo.size <= 0) {
        return Result.Succeeded({newBoostLabs: [], removedFromResearchOutputLabs: []})
      }

      const unassignedLabs = this.unassignedLabs()
      const researchOutputLabs = this.researchOutputLabs()
      const assignableLabCount = unassignedLabs.length + researchOutputLabs.length

      const assignableLabs: StructureLab[] = [
        ...unassignedLabs,
        ...researchOutputLabs,
      ]

      const newBoostLabs: {lab: StructureLab, boost: MineralBoostConstant, requiredAmount: number}[] = []
      Array.from(boostInfo.entries()).forEach(([boost, requiredAmount], index) => {
        const lab = assignableLabs[index]
        if (lab == null) {
          throw `lack of available labs. assignable lab count: ${assignableLabCount} > ${boostInfo.size} boosts`
        }
        newBoostLabs.push({
          boost,
          lab,
          requiredAmount,
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

      const newBoostLabInfo: BoostLabInfo[] = newBoostLabs.map(labInfo => ({ labId: labInfo.lab.id, boost: labInfo.boost, requiredAmount: labInfo.requiredAmount }))
      this.roomInfo.boostLabs.push(...newBoostLabInfo)

      const launcher = BoostLabChargerProcessLauncher.launcher()
      if (launcher != null) {
        const runningProcess = launcher.getRunningProcess(this.roomName)
        if (runningProcess == null) {
          launcher.launch(this.roomName)
        }
      } else {
        PrimitiveLogger.programError(`OwnedRoomInfoAccessor ${roomLink(this.roomName)} addBoosts() no BoostLabChargerProcessLauncher provided`)
      }

      return Result.Succeeded({
        newBoostLabs: newBoostLabInfo,
        removedFromResearchOutputLabs,
      })
    } catch (error) {
      return Result.Failed(`${error}`)
    }
  }
  public decreaseRequiredBoostAmount(boost: MineralBoostConstant, amount: number): void {
    const boostLabInfo = this.roomInfo.boostLabs.find(boostLabInfo => boostLabInfo.boost === boost)
    if (boostLabInfo == null) {
      return
    }
    boostLabInfo.requiredAmount = Math.max(boostLabInfo.requiredAmount - amount, 0)
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
    this.roomInfo.boostLabs = []
    return {
      addedToResearchOutputLabIds,
      removedBoosts,
    }
  }

  /** @deprecated boostLabsを利用する */
  public getBoostLabs(): BoostLabInfo[] {
    return [...this.roomInfo.boostLabs]
  }

  private getBoostLabInstances(): BoostLab[] {
    return this.roomInfo.boostLabs.flatMap((labInfo): BoostLab[] => {
      const lab = Game.getObjectById(labInfo.labId)
      if (lab == null) {
        return []
      }
      return [{
        lab,
        boost: labInfo.boost,
        requredAmount: labInfo.requiredAmount,
      }]
    })
  }

  private getResearchLabs(): { inputLab1: StructureLab, inputLab2: StructureLab, outputLabs: StructureLab[] } | null {
    if (this.roomInfo.researchLab == null) {
      return null
    }

    const getLab = (labId: Id<StructureLab>): StructureLab | null => {
      return Game.getObjectById(labId)
    }

    const inputLab1 = getLab(this.roomInfo.researchLab.inputLab1)
    const inputLab2 = getLab(this.roomInfo.researchLab.inputLab2)
    if (inputLab1 == null || inputLab2 == null) {
      this.roomInfo.researchLab = undefined
      return null
    }

    const outputLabs = this.researchOutputLabs()
    return {
      inputLab1,
      inputLab2,
      outputLabs,
    }
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

  private parseLinks(): LinkInfo {
    const parse = (linkId: Id<StructureLink> | null): StructureLink | null => {
      if (linkId == null) {
        return null
      }
      return Game.getObjectById(linkId)
    }

    const core = parse(this.roomInfo.links.coreLinkId)
    if (core == null && this.roomInfo.links.coreLinkId != null) {
      this.roomInfo.links.coreLinkId = null
    }

    const upgrader = parse(this.roomInfo.links.upgraderLinkId)
    if (upgrader == null && this.roomInfo.links.upgraderLinkId != null) {
      this.roomInfo.links.upgraderLinkId = null
    }

    const sources = new Map<Id<Source>, StructureLink>()
    Array.from(Object.entries(this.roomInfo.links.sourceLinkIds)).forEach(([sourceId, linkId]) => {
      const link = parse(linkId)
      if (link == null) {
        delete this.roomInfo.links.sourceLinkIds[sourceId]
        return
      }
      sources.set(sourceId as Id<Source>, link)
    })

    return {
      core,
      upgrader,
      sources,
    }
  }

  public setLinkId(linkId: Id<StructureLink>, role: "core" | "upgrader" | Id<Source>): void {
    switch (role) {
    case "core":
      this.roomInfo.links.coreLinkId = linkId
      break
    case "upgrader":
      this.roomInfo.links.upgraderLinkId = linkId
      break
    default:
      this.roomInfo.links.sourceLinkIds[role] = linkId
      break
    }
  }

  /// 他Roomへ送付すると支障のでる資源
  public usingResourceTypes(): { boosts: MineralBoostConstant[], research: ResourceConstant[], commodities: ResourceConstant[], harvesting: ResourceConstant[] } {
    const research: ResourceConstant[] = []
    const addResearchResource = (resourceType: ResourceConstant): void => {
      if (research.includes(resourceType) === true) {
        return
      }
      research.push(resourceType)
    }
    this.config.researchingCompounds().forEach(researchCompound => {
      addResearchResource(researchCompound)
      const ingredients = MineralCompoundIngredients[researchCompound]
      addResearchResource(ingredients.lhs)
      addResearchResource(ingredients.rhs)
    })

    const harvesting: ResourceConstant[] = []
    if (this.mineralType != null) {
      harvesting.push(this.mineralType)
    }

    return {
      boosts: this.getBoostLabs().map(labInfo => labInfo.boost),
      research,
      commodities: [],  // TODO:
      harvesting,
    }
  }

  public usingAllResourceTypes(): ResourceConstant[] {
    const result: ResourceConstant[] = []
    const add = (resourceType: ResourceConstant): void => {
      if (result.includes(resourceType) === true) {
        return
      }
      result.push(resourceType)
    }

    Array.from(Object.values(this.usingResourceTypes())).forEach(resourceTypes => {
      resourceTypes.forEach(resourceType => add(resourceType))
    })

    return result
  }

  public labsForUnboost(): StructureLab[] {
    const excludedLabs: StructureLab[] = [
      ...this.boostLabs.map(labInfo => labInfo.lab),
    ]

    const researchLabs = this.researchLabs
    if (researchLabs != null) {
      excludedLabs.push(researchLabs.inputLab1)
      excludedLabs.push(researchLabs.inputLab2)
    }

    return (this.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[])
      .filter(lab => {
        if (excludedLabs.includes(lab) === true) {
          return false
        }
        if (lab.cooldown > 0) {
          return false
        }
        return true
      })
  }

  public evacuateDestination(): RoomName {
    const configuredDestination = this.config.evacuationDestinations()[0]
    if (configuredDestination != null) {
      return configuredDestination
    }
    const preSetNeighbour = this.roomInfo.neighbourRoomNames[0]
    if (preSetNeighbour != null) {
      return preSetNeighbour
    }
    PrimitiveLogger.programError(`OwnedRoomInfoAccessor ${roomLink(this.room.name)} doesn't have config.evacuationDestinations or neighbourRoomNames`)

    return this.room.name
  }
}
