/**
 # TrafficDriver
 ## 概要
 Creep移動の最適化を行う

 ## 対応する状況
 - 静止しているCreepの位置を経路に含めない
 - 邪魔なCreepを移動させる
 - 同じ位置に移動しない
 - moveの代わりにtransferを使用する

 ## 未対応機能
 - CPU時間削減
 */

import { V8Creep } from "prototype/creep"
import { Position } from "prototype/room_position"
import { RoomName } from "utility/room_name"
import { ValuedMapMap } from "utility/valued_collection"
import { Driver } from "../driver"

type IntraRoomPositionId = string
const getIntraRoomPositionId = (position: Position): IntraRoomPositionId => `${position.x}_${position.y}`

type MovabilityImpossible = {
  readonly case: "impossible"
}
type MovabilityLimited = {
  readonly case: "limited"
  readonly center: Position
  readonly range: number
}
type MovabilityAnywhere = {
  readonly case: "anywhere"
}
type Movability = MovabilityImpossible | MovabilityLimited | MovabilityAnywhere

type TrafficTypeStanding = {
  readonly case: "standing"
}
type TrafficTypeMove = {
  readonly case: "move"
  readonly direction: DirectionConstant
}
type TrafficType = (TrafficTypeStanding | TrafficTypeMove) & {
  readonly creep: V8Creep
}

const traffic = new ValuedMapMap<RoomName, IntraRoomPositionId, TrafficType>()

interface TrafficDriverInterface extends Driver {
  addTraffic(position: RoomPosition, traffic: TrafficType): void
}

export const TrafficDriver: TrafficDriverInterface = {
  // ---- OS API ---- //
  // load(): void {
  // },

  startOfTick(): void {
    traffic.clear()
  },

  endOfTick(): void {

  },

  //
  addTraffic(position: RoomPosition, traffic: TrafficType): void {

  },
}
