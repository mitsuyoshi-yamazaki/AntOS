import { AssignedPositions, CreepPositionAssignerProcessApi } from "@private/os_v5/processes/game_object_management/creep/creep_position_assigner_process"
import { SerializableObject } from "shared/utility/serializable_types"
import { reverseConstMapping, ReversedMapping } from "shared/utility/strict_entries"


export const roomModuleDecodingMap = {
  a: "SourceLink",
} as const

export type RoomModuleEncodingMap = ReversedMapping<typeof roomModuleDecodingMap>
export const roomModuleEncodingMap = reverseConstMapping(roomModuleDecodingMap)
export type SerializedRoomModules = keyof typeof roomModuleDecodingMap
export type RoomModules = keyof typeof roomModuleEncodingMap


export type RoomModuleState = SerializableObject & {
  readonly t: SerializedRoomModules
}


export abstract class RoomModule<
  State extends RoomModuleState,
  GameObject,
  Api extends CreepPositionAssignerProcessApi,
  Assigns extends AssignedPositions[],
  Layout,
  > {

  abstract encode(): State

  abstract checkPrecondition(room: Room): boolean
  abstract make(obj: GameObject, api: Api, assigns: Assigns): {layout: Layout, assigns: Assigns} | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModule = RoomModule<RoomModuleState, any, any, any, any>
