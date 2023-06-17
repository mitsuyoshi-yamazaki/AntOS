/**
 # OwnedRoomResourceDriver
 ## 概要
 最も汎用なRoomの不動産を管理する

 ## Memo
 loadで構築→IDを保存してtick→取得時にgetObjectByIdで復元する
 */

import { RoomName } from "shared/utility/room_name_types"
import { Driver } from "../../../driver"
import {} from "./owned_room_resource"

interface OwnedRoomResourceDriverInterface extends Driver {
  get(roomName: RoomName):
}

export const OwnedRoomResourceDriver: Driver = {
  // load(): void {},
  // startOfTick(): void {},
  // endOfTick(): void {},


}
