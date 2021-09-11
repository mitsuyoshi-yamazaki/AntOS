import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../process_state"

type SourceRequest = {
  readonly source: Source
}

export interface OwnedRoomStaticObjectRequesterProcessState extends ProcessState {
  readonly roomName: RoomName
}

/**
 * - 基本的なアイデア
 *   - ゲーム中に短期間で変化しない、Roomに紐づくオブジェクト（Source, Mineral, etc）のリクエストを上げる
 */
export class OwnedRoomStaticObjectRequesterProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): OwnedRoomStaticObjectRequesterProcessState {
    return {
      t: "OwnedRoomStaticObjectRequesterProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
    }
  }

  public static decode(state: OwnedRoomStaticObjectRequesterProcessState): OwnedRoomStaticObjectRequesterProcess {
    return new OwnedRoomStaticObjectRequesterProcess(state.l, state.i, state.roomName)
  }

  public static create(processId: ProcessId, roomName: RoomName): OwnedRoomStaticObjectRequesterProcess {
    return new OwnedRoomStaticObjectRequesterProcess(Game.time, processId, roomName)
  }

  public runOnTick(): void {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      return
    }

    const sources = room.find(FIND_SOURCES)
    const sourceRequests = sources.map(source => this.sourceRequest(source))

  }

  private sourceRequest(source: Source): SourceRequest {
    return {
      source,
    }
  }
}
