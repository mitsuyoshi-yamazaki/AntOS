import { Position } from "prototype/room_position"
import { Result } from "shared/utility/result"
import type { RoomName } from "shared/utility/room_name_types"
import { UniqueId } from "utility/unique_id"
import { flagColors, LayoutMark, RoomPlannerInterface } from "./room_planner"

const layout: LayoutMark[][] = [
  ["x", "x", "x", "x", "x", "x", "x", "x", "x"],
  ["x", "-", "x", "-", "x", "-", "x", "-", "x"],
  ["x", "x", "c", "x", "x", "x", "c", "x", "x"],
  ["x", "-", "x", "-", "-", "-", "x", "-", "x"],
  ["x", "x", "x", "-", "s", "-", "x", "x", "x"],
  [".", ".", ".", "-", "-", "-", "-", "-", "-"],
  [".", ".", "t", "-", "o", "-", "c", "-", "6"],
  [".", ".", "-", "o", "-", "o", "-", "-", "6"],
  [".", ".", "o", "-", "o", "-", "o", "-", "6"],
]

export class Mark01RoomPlanner implements RoomPlannerInterface {
  private readonly roomName: RoomName

  public constructor(
    private readonly controller: StructureController,
    private readonly originPosition: Position,
  ) {
    this.roomName = this.controller.room.name
  }

  public run(): Result<{ center: RoomPosition }, string> {
    try {
      layout.forEach((row, y) => {
        row.forEach((mark, x) => {
          const position = new RoomPosition(this.originPosition.x + x, this.originPosition.y + y, this.roomName)
          this.placeFlag(position, mark)
        })
      })

      return Result.Succeeded({
        center: new RoomPosition(this.originPosition.x + 4, this.originPosition.y + 5, this.roomName)
      })

    } catch (error) {
      return Result.Failed(`${error}`)
    }
  }

  private placeFlag(position: RoomPosition, mark: LayoutMark): void {
    const flagColor = flagColors[mark]
    if (flagColor == null) {
      return
    }
    const room = this.controller.room
    room.createFlag(position, UniqueId.generate(), flagColor)
  }
}
