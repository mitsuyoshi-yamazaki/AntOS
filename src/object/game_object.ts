import { ErrorMapper } from "error_mapper/ErrorMapper"
import { Procedural } from "old_objective/procedural"
import { State, Stateful } from "os/infrastructure/state"
import { RoomName } from "prototype/room"
import { generateUniqueId } from "utility/unique_id"

export type GameObjectName = string

export interface GameObjectState extends State {
  /** type identifier */
  t: keyof GameObjectTypes

  /** launch time */
  l: number

  /** name */
  n: GameObjectName
}

export interface GameObject extends Stateful {
  launchTime: number
  name: GameObjectName
}


class GameObjectTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "WorkerSquadObject" = (state: GameObjectState) => WorkerSquadObject.decode(state as WorkerSquadObjectState)
}

export function decodeGameObjectFrom(state: GameObjectState): GameObject | null {
  return ErrorMapper.wrapLoop((): GameObject | null => {
    const maker = (new GameObjectTypes())[state.t]
    if (maker == null) {
      return null
    }
    return maker(state)
  }, `decodeGameObjectFrom(), objective type: ${state.t}`)()
}

// ----
export interface WorkerSquadObjectState extends GameObjectState {
  /** room name */
  r: RoomName
}

export class WorkerSquadObject implements GameObject, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly name: GameObjectName,
    public readonly roomName: RoomName,
  ) { }

  public encode(): WorkerSquadObjectState {
    return {
      t: "WorkerSquadObject",
      l: this.launchTime,
      n: this.name,
      r: this.roomName,
    }
  }

  public static decode(state: WorkerSquadObjectState): WorkerSquadObject {
    return new WorkerSquadObject(state.l, state.n, state.r)
  }

  public static generateUniqueName(roomName: string): string {
    return generateUniqueId(`${this.name}_${roomName}`)
  }

  public runOnTick(): void {

  }
}
