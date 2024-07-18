import { Position } from "shared/utility/position_v2"
import { RoomName } from "shared/utility/room_name_types"

export type RoomPathState = {
  // RoomNameは別で保存
  readonly i: string      /// ID
  readonly p: Position[]  /// Path
}

export class RoomPath {
  public get directions(): DirectionConstant[] {
    if (this._directions == null) {
      this._directions = this.getDirections()
    }
    return [...this.directions]
  }

  private constructor(
    public readonly id: string,
    public readonly roomName: RoomName,
    public readonly path: Position[],
    private _directions: DirectionConstant[] | null,
  ) {
  }

  public encode(): RoomPathState {
    return {
      i: this.id,
      p: this.path,
    }
  }

  public static decode(state: RoomPathState, roomName: RoomName): RoomPath {
    return new RoomPath(state.i, roomName, state.p, null)
  }

  public static create(id: string, roomName: RoomName, path: Position[]): RoomPath {
    return new RoomPath(id, roomName, path, null)
  }

  public static createWithRoomPositionPath(id: string, roomName: RoomName, path: RoomPosition[]): RoomPath {
    const encodablePath = path.map(position => ({ x: position.x, y: position.y } as Position))
    const directions: DirectionConstant[] = []

    path.reduce((previous, current) => {
      directions.push(previous.getDirectionTo(current))
      return current
    })

    return new RoomPath(id, roomName, encodablePath, directions)
  }

  public contains(position: Position): boolean {
    console.log("contains() not implemented yet")
    return false  // TODO:
  }

  public nextPosition(position: Position, direction: "todo"): Position | null {
    console.log("nextPosition() not implemented yet")
    return null // TODO:
  }

  public nextDirection(position: Position, direction: "todo"): DirectionConstant | null {
    console.log("nextDirection() not implemented yet")
    return null // TODO:
  }


  // ---- Private ---- //
  private getDirections(): DirectionConstant[] {
    console.log("getDirections() not implemented yet")
    return [] // TODO:
  }
}
