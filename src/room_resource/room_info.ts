import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { Position } from "prototype/room_position"
import type { WallPosition } from "script/wall_builder"
import type { RoomName } from "utility/room_name"
import { ShortVersion, ShortVersionV6 } from "utility/system_info"
import type { Timestamp } from "utility/timestamp"

export type ResourceInsufficiency = number | "optional" | "urgent"

export type RemoteRoomInfo = {
  readonly roomName: RoomName
  enabled: boolean
  routeCalculatedTimestamp: { [sourceId: string]: Timestamp}
  constructionFinished: boolean
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
}

type RoomOwner = { ownerType: "claim", username: string, isAlive: boolean, safemodeEnabled: boolean } | { ownerType: "reserve", username: string }

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
  boostLabs?: Id<StructureLab>[]
  excludedRemotes?: RoomName[]
  waitingPosition?: Position
  genericWaitingPositions?: Position[]
  enableAutoAttack?: boolean
  noRepairWallIds?: Id<StructureWall | StructureRampart>[]
  mineralMaxAmount?: number
  constructionInterval?: number
  concurrentConstructionSites?: number
  powers?: PowerConstant[]
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
  highestRcl: number
  roomPlan: {
    centerPosition: Position
    // virtualStructures: VirtualStructure[]

    /** @deprecated */
    wallPositions?: WallPosition[]
  } | null

  // ---- Remote Room ---- //
  remoteRoomInfo: { [roomName: string]: RemoteRoomInfo}

  // ---- Inter Room ---- //
  // TODO: 同様にCreepも送れるようにする
  readonly resourceInsufficiencies: { [K in ResourceConstant]?: ResourceInsufficiency }

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
    return {
      ownerType: "claim",
      isAlive,
      safemodeEnabled: room.controller.safeMode != null,
      username: room.controller.owner.username
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
    reachable: true,
    remoteRoomInfo: {},
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
    reachable: normalRoomInfo.reachable,
    remoteRoomInfo: {},
  }
}
