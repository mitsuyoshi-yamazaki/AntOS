import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { RoomName } from "utility/room_name"
import { ShortVersion, ShortVersionV6 } from "utility/system_info"
import { Timestamp } from "utility/timestamp"

type ResourceInsufficiencyPriorityRequired = 0
type ResourceInsufficiencyPriorityOptional = 1
const resourceInsufficiencyPriorityRequired: ResourceInsufficiencyPriorityRequired = 0
const resourceInsufficiencyPriorityOptional: ResourceInsufficiencyPriorityOptional = 1
export type ResourceInsufficiencyPriority = ResourceInsufficiencyPriorityRequired | ResourceInsufficiencyPriorityOptional
export const ResourceInsufficiencyPriority = {
  Required: resourceInsufficiencyPriorityRequired,
  Optional: resourceInsufficiencyPriorityOptional,
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
}

export interface NormalRoomInfo extends BasicRoomInfo {
  readonly roomType: "normal"
  // roomPlan: RemoteHarvestRoomPlan | null

  observedAt: Timestamp
  owner: { claimingUser: string } | { reservingUser: string } | null
}

/**
 * - エネルギーの充填優先度として平準化する
 *   - 低い順にterminal, storage,
 */
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
    centerPosition: {x: number, y: number}
  } | null

  // ---- Inter Room ---- //
  // TODO: 同様にCreepも送れるようにする
  readonly resourceInsufficiencies: { [K in ResourceConstant]?: ResourceInsufficiencyPriority }

  config?: {
    disablePowerHarvesting?: boolean
    disableMineralHarvesting?: boolean
    disableUnnecessaryTasks?: boolean
    enableOperateSpawn?: boolean
    researchCompounds?: { [index in MineralCompoundConstant]?: number }
    collectResources?: boolean
    boostLabs?: Id<StructureLab>[]
  }
}

export type RoomInfoType = NormalRoomInfo | OwnedRoomInfo

function getOwnerInfo(room: Room): { claimingUser: string } | { reservingUser: string } | null {
  if (room.controller == null) {
    return null
  }
  if (room.controller.owner != null) {
    return {
      claimingUser: room.controller.owner.username
    }
  }
  if (room.controller.reservation != null) {
    return {
      reservingUser: room.controller.reservation.username
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
  }
}
