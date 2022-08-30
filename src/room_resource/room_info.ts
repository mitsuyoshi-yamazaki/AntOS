import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { Position } from "prototype/room_position"
import type { WallPosition } from "script/wall_builder"
import type { RoomName } from "shared/utility/room_name"
import { ShortVersion, ShortVersionV6 } from "shared/utility/system_info"
import type { Timestamp } from "shared/utility/timestamp"

export type ResourceInsufficiency = number | "optional" | "urgent"

type RemoteRoomTestConfig = {
  travelerEnabled?: boolean
}

export type RemoteRoomInfo = {
  readonly roomName: RoomName
  enabled: boolean
  routeCalculatedTimestamp: { [sourceId: string]: Timestamp}
  constructionFinished: boolean
  testConfig?: RemoteRoomTestConfig
}

export type BoostLabInfo = {
  readonly labId: Id<StructureLab>
  readonly boost: MineralBoostConstant
  requiredAmount: number
}

type LinkInfo = {
  coreLinkId: Id<StructureLink> | null
  upgraderLinkId: Id<StructureLink> | null
  sourceLinkIds: { [sourceId: string]: Id<StructureLink> }
}

type OwnedRoomTypeNormal = {
  readonly case: "normal"
}
type OwnedRoomTypeMinimumCpuUse = {
  readonly case: "minimum-cpu-use"
}

type OwnedRoomType = OwnedRoomTypeNormal | OwnedRoomTypeMinimumCpuUse
type OwnedRoomCase = OwnedRoomType["case"]

export function isOwnedRoomTypes(arg: string): arg is OwnedRoomCase {
  if (arg === "normal" || arg === "minimum-cpu-use") {
    return true
  }
  return false
}

export interface BasicRoomInfo {
  readonly v: ShortVersionV6
  readonly roomType: "normal" | "owned"

  // FixMe: readonlyにする
  numberOfSources: number
  neighbourRoomNames: RoomName[]

  // ---- Structure ---- //
  readonly energySourceStructureIds: Id<EnergySource>[]
  readonly energyStoreStructureIds: Id<EnergyStore>[]

  reachable: boolean

  readonly localWhitelistedUsers?: string[]
}

type RoomOwner = { ownerType: "claim", username: string, isAlive: boolean, safemodeEnabled: boolean, upgradeBlockedUntil: Timestamp | null }
  | { ownerType: "reserve", username: string }

export interface NormalRoomInfo extends BasicRoomInfo {
  readonly roomType: "normal"
  // roomPlan: RemoteHarvestRoomPlan | null

  observedAt: Timestamp
  owner: RoomOwner | null
}

export type OwnedRoomConfig = {
  disablePowerHarvesting?: boolean
  disableMineralHarvesting?: boolean
  disableUnnecessaryTasks?: boolean
  researchCompounds?: { [index in MineralCompoundConstant]?: number }
  collectResources?: boolean
  waitingPosition?: Position
  genericWaitingPositions?: Position[]
  enableAutoAttack?: boolean
  noRepairWallIds?: Id<StructureWall | StructureRampart>[]
  mineralMaxAmount?: number
  constructionInterval?: number
  concurrentConstructionSites?: number
  powers?: PowerConstant[]
  wallMaxHits?: number
  extraLinkIds?: Id<StructureLink>[]

  /// bootstrap中だけではなく、リスポーン後の最初の部屋にも適用される
  useSafemodeInBoostrap?: boolean
  bootstrapUntilRcl5?: boolean
  forceAttack?: boolean

  /// nuke, low RCL invasion
  evacuationDestinations?: RoomName[]
  nonHidableRampartIds?: Id<StructureRampart>[]
}

export interface OwnedRoomInfo extends BasicRoomInfo {
  readonly roomType: "owned"

  // ---- Room Plan ---- //
  // readonly roomPlan: OwnedRoomPlan

  // ---- Structure ---- //
  readonly chargeStructureIds: Id<EnergyChargeableStructure>[]
  researchLab?: {
    readonly inputLab1: Id<StructureLab>
    readonly inputLab2: Id<StructureLab>
    readonly outputLabs: Id<StructureLab>[]
  }
  boostLabs: BoostLabInfo[]
  highestRcl: number
  roomPlan: {
    centerPosition: Position
    // virtualStructures: VirtualStructure[]

    /** @deprecated */
    wallPositions?: WallPosition[]
  } | null
  links: LinkInfo // TODO: readonlyにする

  // ---- Remote Room ---- //
  remoteRoomInfo: { [roomName: string]: RemoteRoomInfo}

  // ---- Inter Room ---- //
  // TODO: 同様にCreepも送れるようにする
  readonly resourceInsufficiencies: { [K in ResourceConstant]?: ResourceInsufficiency }

  ownedRoomType: OwnedRoomType

  /** @deprecated use OwnedRoomInfoAccessor.config instead */
  config?: OwnedRoomConfig
}

export type RoomInfoType = NormalRoomInfo | OwnedRoomInfo

function getOwnerInfo(room: Room): RoomOwner | null {
  if (room.controller == null) {
    return null
  }
  if (room.controller.owner != null) {
    const isAlive = ((): boolean => {
      if (room.find(FIND_HOSTILE_STRUCTURES, { filter: {structureType: STRUCTURE_SPAWN}}).length > 0) {
        return true
      }
      return false
    })()
    const upgradeBlockedUntil = ((): Timestamp | null => {
      if (room.controller.upgradeBlocked == null) {
        return null
      }
      return Game.time + room.controller.upgradeBlocked
    })()
    return {
      ownerType: "claim",
      isAlive,
      safemodeEnabled: room.controller.safeMode != null,
      username: room.controller.owner.username,
      upgradeBlockedUntil,
    }
  }
  if (room.controller.reservation != null) {
    return {
      ownerType: "reserve",
      username: room.controller.reservation.username
    }
  }
  return null
}

export function updateNormalRoomInfo(room: Room, roomInfo: NormalRoomInfo): void {
  roomInfo.observedAt = Game.time
  roomInfo.owner = getOwnerInfo(room)
}

function getNeighbourRoomNames(room: Room): RoomName[] {
  const exits = Game.map.describeExits(room.name)
  if (exits == null) { // sim環境ではundefinedが返る
    return []
  }
  return Array.from(Object.values(exits))
}

export function buildNormalRoomInfo(room: Room): NormalRoomInfo {
  return {
    v: ShortVersion.v6,
    roomType: "normal",
    observedAt: Game.time,
    owner: getOwnerInfo(room),
    numberOfSources: room.find(FIND_SOURCES).length,
    neighbourRoomNames: getNeighbourRoomNames(room),
    energySourceStructureIds: [],
    energyStoreStructureIds: [],
    reachable: true,
  }
}

export function buildOwnedRoomInfo(arg: NormalRoomInfo | Room): OwnedRoomInfo {
  if (arg instanceof Room) {
    return createOwnedRoomInfo(arg)
  } else {
    return buildOwnedRoomInfoFrom(arg)
  }
}

function createOwnedRoomInfo(room: Room): OwnedRoomInfo {
  const useSafemodeInBoostrap = ((): boolean | undefined => {
    const numberOfOwnedRooms = Array.from(Object.values(Game.rooms)).filter(room => room.controller != null && room.controller.my === true).length
    if (numberOfOwnedRooms <= 1) {
      return true
    }
    return undefined
  })()
  return {
    v: ShortVersion.v6,
    roomType: "owned",
    numberOfSources: room.find(FIND_SOURCES).length,
    neighbourRoomNames: getNeighbourRoomNames(room),
    chargeStructureIds: [],
    energySourceStructureIds: [],
    energyStoreStructureIds: [],
    resourceInsufficiencies: {},
    highestRcl: 1,
    roomPlan: null,
    links: {
      coreLinkId: null,
      upgraderLinkId: null,
      sourceLinkIds: {},
    },
    reachable: true,
    remoteRoomInfo: {},
    boostLabs: [],
    ownedRoomType: {
      case: "normal",
    },
    config: {
      useSafemodeInBoostrap,
    }
  }
}


function buildOwnedRoomInfoFrom(normalRoomInfo: NormalRoomInfo): OwnedRoomInfo {
  return {
    v: ShortVersion.v6,
    roomType: "owned",
    numberOfSources: normalRoomInfo.numberOfSources,
    neighbourRoomNames: normalRoomInfo.neighbourRoomNames,
    chargeStructureIds: [],
    energySourceStructureIds: normalRoomInfo.energySourceStructureIds ?? [],
    energyStoreStructureIds: normalRoomInfo.energyStoreStructureIds ?? [],
    resourceInsufficiencies: {},
    highestRcl: 1,
    roomPlan: null,
    links: {
      coreLinkId: null,
      upgraderLinkId: null,
      sourceLinkIds: {},
    },
    reachable: normalRoomInfo.reachable,
    remoteRoomInfo: {},
    boostLabs: [],
    ownedRoomType: {
      case: "normal",
    },
  }
}
