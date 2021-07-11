import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { findPath, findPathToSource, placeRoadConstructionMarks, showCachedSourcePath } from "script/pathfinder"
import { placeOldRoomPlan, showOldRoomPlan } from "script/room_plan"
import { showTargetedBy } from "script/task_target_cache_viewer"
import { showPositionsInRange } from "script/room_position_script"

export class ExecCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    switch (this.args[0]) {
    case "FindPath":
      return this.findPath()
    case "FindPathToSource":
      return this.findPathToSource()
    case "ShowCachedSourcePath":
      return this.showCachedSourcePath()
    case "ShowOldRoomPlan":
      return this.showOldRoomPlan()
    case "PlaceOldRoomPlan":
      return this.placeOldRoomPlan()
    case "ShowTargetedBy":
      return this.showTargetedBy()
    case "PlaceRoadConstructionMarks":
      return this.placeRoadConstructionMarks()
    case "ShowPositionsInRange":
      return this.showPositionsInRange()
    default:
      return "Invalid script type"
    }
  }

  // ---- Parse arguments ---- //
  private parseProcessArguments(): Map<string, string> {
    const args = this.args.concat([])
    args.splice(0, 1)
    const result = new Map<string, string>()
    args.forEach(arg => {
      const components = arg.split("=")
      if (components.length !== 2) {
        return
      }
      result.set(components[0], components[1])
    })
    return result
  }

  private missingArgumentError(argumentName: string): CommandExecutionResult {
    return `Missing ${argumentName} argument`
  }

  // ---- Execute ---- //
  private findPath(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const startObjectId = args.get("start_object_id")
    if (startObjectId == null) {
      return this.missingArgumentError("start_object_id")
    }

    const goalObjectId = args.get("goal_object_id")
    if (goalObjectId == null) {
      return this.missingArgumentError("goal_object_id")
    }

    return findPath(startObjectId, goalObjectId)
  }

  private findPathToSource(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const spawnName = args.get("spawn_name")
    if (spawnName == null) {
      return this.missingArgumentError("spawn_name")
    }

    const sourceId = args.get("source_id")
    if (sourceId == null) {
      return this.missingArgumentError("source_id")
    }

    return findPathToSource(spawnName, sourceId as Id<Source>)
  }

  private showCachedSourcePath(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const sourceId = args.get("source_id")
    if (sourceId == null) {
      return this.missingArgumentError("source_id")
    }

    return showCachedSourcePath(sourceId as Id<Source>)
  }

  private showOldRoomPlan(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }

    const layoutName = args.get("layout_name")
    if (layoutName == null) {
      return this.missingArgumentError("layout_name")
    }

    const x = args.get("x")
    if (x == null) {
      return this.missingArgumentError("x")
    }
    const parsedX = parseInt(x, 10)
    if (isNaN(parsedX)) {
      return `x is not a number (${x})`
    }

    const y = args.get("y")
    if (y == null) {
      return this.missingArgumentError("y")
    }
    const parsedY = parseInt(y, 10)
    if (isNaN(parsedY)) {
      return `y is not a number (${y})`
    }

    return showOldRoomPlan(roomName, layoutName, parsedX, parsedY)
  }

  private placeOldRoomPlan(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }

    const layoutName = args.get("layout_name")
    if (layoutName == null) {
      return this.missingArgumentError("layout_name")
    }

    const x = args.get("x")
    if (x == null) {
      return this.missingArgumentError("x")
    }
    const parsedX = parseInt(x, 10)
    if (isNaN(parsedX)) {
      return `x is not a number (${x})`
    }

    const y = args.get("y")
    if (y == null) {
      return this.missingArgumentError("y")
    }
    const parsedY = parseInt(y, 10)
    if (isNaN(parsedY)) {
      return `y is not a number (${y})`
    }

    return placeOldRoomPlan(roomName, layoutName, parsedX, parsedY)
  }

  private showTargetedBy(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const targetIds = args.get("target_ids")
    if (targetIds == null) {
      return this.missingArgumentError("target_ids")
    }

    return showTargetedBy(targetIds.split(","))
  }

  private placeRoadConstructionMarks(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const startObjectId = args.get("start_object_id")
    if (startObjectId == null) {
      return this.missingArgumentError("start_object_id")
    }
    const startObject = Game.getObjectById(startObjectId)
    if (!(startObject instanceof RoomObject)) {
      return `${startObject} is not RoomObject ${startObjectId}`
    }

    const goalObjectId = args.get("goal_object_id")
    if (goalObjectId == null) {
      return this.missingArgumentError("goal_object_id")
    }
    const goalObject = Game.getObjectById(goalObjectId)
    if (!(goalObject instanceof RoomObject)) {
      return `${goalObject} is not RoomObject ${goalObjectId}`
    }

    placeRoadConstructionMarks(startObject.pos, goalObject.pos, "manual")
    return "ok"
  }

  private showPositionsInRange(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const xString = args.get("x")
    if (xString == null) {
      return this.missingArgumentError("x")
    }
    const x = parseInt(xString)
    if (isNaN(x) === true) {
      return `x is not a number (${xString})`
    }
    const yString = args.get("y")
    if (yString == null) {
      return this.missingArgumentError("y")
    }
    const y = parseInt(yString)
    if (isNaN(y) === true) {
      return `x is not a number (${yString})`
    }
    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const rangeString = args.get("range")
    if (rangeString == null) {
      return this.missingArgumentError("range")
    }
    const range = parseInt(rangeString)
    if (isNaN(range) === true) {
      return `x is not a number (${rangeString})`
    }

    const position = new RoomPosition(x, y, roomName)
    showPositionsInRange(position, range)
    return "ok"
  }
}
