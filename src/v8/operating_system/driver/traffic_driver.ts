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

 ## 仕様
 - ProcessもしくはCreepTask（未定）はTrafficDriverへCreepがどのような移動を行いたいかリクエストを挙げる
 - TrafficDriverはリクエストの優先順位にもとづきCreep.move()を呼び出す

 ## TODO
 - Resource Transfer Managerも作る
 */

import { V9Creep } from "prototype/creep"
import { Position } from "prototype/room_position"
import { RoomName } from "utility/room_name"
import { ValuedArrayMap, ValuedMapMap } from "utility/valued_collection"
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
type MovabilityType = Movability["case"]

type TrafficStanding = {
  readonly case: "standing"
  readonly movability: Movability
}
type TrafficMove = {
  readonly case: "move"
  readonly direction: DirectionConstant
}
type Traffic = (TrafficStanding | TrafficMove) & {
  readonly creep: V9Creep
}
type TrafficType = Traffic["case"]

type MovementKeepPosition = {
  readonly case: "keep position"
  readonly targetPosition: RoomPosition
  readonly minimumRange: number
  readonly maximumRange: number
}
type MovementMoveTo = {
  readonly case: "move to"
  readonly targetPosition: RoomPosition
}
type MovementFlee = {
  readonly case: "flee"
  readonly target
}
type TrafficRequest = {
  readonly creep: V9Creep

}

const standingTrafficRequests = new ValuedArrayMap<MovabilityType, TrafficRequest>()
const primaryTrafficRequests = new ValuedArrayMap<TrafficType, TrafficRequest>()

interface TrafficDriverInterface extends Driver {
  /** request.position は移動先位置 */
  addTrafficRequest(request: TrafficRequest): void
}

export const TrafficDriver: TrafficDriverInterface = {
  // ---- OS API ---- //
  // load(): void {
  // },

  startOfTick(): void {
    standingTrafficRequests.clear()
    primaryTrafficRequests.clear()
  },

  endOfTick(): void {
    const traffic = resolveRequests()
    callMoveApi(traffic)
  },

  // ---- ---- //
  addTrafficRequest(request: TrafficRequest): void {
    switch (request.traffic.case) {
    case "standing":
      standingTrafficRequests.getValueFor(request.traffic.movability.case).push(request)
      break
    case "move":
      primaryTrafficRequests.getValueFor(request.traffic.case).push(request)
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = request.traffic
      break
    }
    }
  },
}

const standingRequestPriority: MovabilityType[] = [
  // 添字が小さい方が優先
  "impossible",
  "limited",
  "anywhere",
]
const resolveRequests = (): Map<RoomName, Map<IntraRoomPositionId, Traffic>> => {
  const traffic = new ValuedMapMap<RoomName, IntraRoomPositionId, Traffic>()

  const standingRequests = Array.from(standingTrafficRequests.entries())
  standingRequests.sort((lhs, rhs) => {
    return standingRequestPriority.indexOf(lhs[0]) - standingRequestPriority.indexOf(rhs[0])
  })

  standingRequests.forEach(([movabilityType, requests]) => {

  })

  return traffic
}

const callMoveApi = (traffic: Map<RoomName, Map<IntraRoomPositionId, Traffic>>): void => {

}
