import type { AnyProcessId } from "os_v5/process/process"
import type { ExtendedV5CreepMemory } from "os_v5/utility/game_object/creep"
import type { CreepName } from "shared/utility/creep"
import type { RoomName } from "shared/utility/room_name_types"
import type { SerializableObject } from "shared/utility/serializable_types"
import type { CreepBody } from "utility/creep_body_v2"

export type CreepRequest<M extends SerializableObject> = {
  readonly processId: AnyProcessId
  readonly requestIdentifier: string  /// Creep生成/失敗通知の判別用
  readonly body: CreepBody
  readonly roomName: RoomName         /// Creepの集合場所：要求者はどこからCreepがやってくるか知らないため、Spawn部屋からroomNameまではProvider側が移動させる: その間の問題は誰が解決するのか？
  readonly options?: {
    readonly codename?: string
    readonly uniqueCreepName?: CreepName
    readonly memory?: ExtendedV5CreepMemory<M>
  }
}
export type CreepProviderApi = {
  requestCreep<M extends SerializableObject>(request: CreepRequest<M>): void
}
