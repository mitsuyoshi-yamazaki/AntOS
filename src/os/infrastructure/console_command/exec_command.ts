import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { findPath, findPathToSource, placeRoadConstructionMarks, showCachedSourcePath } from "script/pathfinder"
import { describeLabs, placeOldRoomPlan, showOldRoomPlan } from "script/room_plan"
import { showPositionsInRange } from "script/room_position_script"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { TransferResourceApiWrapper, TransferResourceApiWrapperTargetType } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { isV5CreepMemory } from "prototype/creep"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { ResourceManager } from "utility/resource_manager"
import { PrimitiveLogger } from "../primitive_logger"
import { coloredResourceType, roomLink } from "utility/log"
import { isResourceConstant } from "utility/resource"

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
    case "PlaceRoadConstructionMarks":
      return this.placeRoadConstructionMarks()
    case "ShowPositionsInRange":
      return this.showPositionsInRange()
    case "DescribeLabs":
      return this.describeLabs()
    case "MoveToRoom":
      return this.moveToRoom()
    case "Transfer":
      return this.transfer()
    case "Pickup":
      return this.pickup()
    case "Resource":
      return this.resource()
    default:
      return "Invalid script type"
    }
  }

  // ---- Parse arguments ---- //
  /** @deprecated */
  private _parseProcessArguments(): Map<string, string> {
    const args = this.args.concat([])
    args.splice(0, 1)
    const result = new Map<string, string>()
    args.forEach(arg => {
      const [key, value] = arg.split("=")
      if (key == null || value == null) {
        return
      }
      result.set(key, value)
    })
    return result
  }

  private missingArgumentError(argumentName: string): CommandExecutionResult {
    return `Missing ${argumentName} argument`
  }

  // ---- Execute ---- //
  private findPath(): CommandExecutionResult {
    const args = this._parseProcessArguments()

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
    const args = this._parseProcessArguments()

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
    const args = this._parseProcessArguments()

    const sourceId = args.get("source_id")
    if (sourceId == null) {
      return this.missingArgumentError("source_id")
    }

    return showCachedSourcePath(sourceId as Id<Source>)
  }

  private showOldRoomPlan(): CommandExecutionResult {
    const args = this._parseProcessArguments()

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
    const args = this._parseProcessArguments()

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

  private placeRoadConstructionMarks(): CommandExecutionResult {
    const args = this._parseProcessArguments()

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
    const args = this._parseProcessArguments()

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

  // ---- ---- //
  private parseProcessArguments(...keys: string[]): string[] | string {
    const args = this.args.concat([])
    args.splice(0, 1)
    const argumentMap = new Map<string, string>()
    args.forEach(arg => {
      const [key, value] = arg.split("=")
      if (key == null || value == null) {
        return
      }
      argumentMap.set(key, value)
    })

    const result: string[] = []
    const missingKeys: string[] = []

    keys.forEach(key => {
      const value = argumentMap.get(key)
      if (value == null) {
        missingKeys.push(key)
        return
      }
      result.push(value)
    })
    if (missingKeys.length > 0) {
      return `Missing arguments: ${missingKeys}`
    }
    return result
  }

  // ---- ---- //
  private describeLabs(): CommandExecutionResult {
    const args = this.parseProcessArguments("room_name")
    if (typeof args === "string") {
      return args
    }
    const [roomName] = args
    if (roomName == null) {
      return "" // FixMe: nullチェック
    }
    return describeLabs(roomName)
  }

  private moveToRoom(): CommandExecutionResult {
    const args = this.parseProcessArguments("creep_name", "room_name", "waypoints")
    if (typeof args === "string") {
      return args
    }
    const [creepName, roomName, rawWaypoints] = args
    if (creepName == null || roomName == null || rawWaypoints == null) {
      return ""
    }
    const waypoints = rawWaypoints.split(",")

    const creep = Game.creeps[creepName]
    if (creep == null) {
      return `Creep ${creepName} doesn't exists`
    }
    if (creep.v5task != null) {
      return `Creep ${creepName} has v5 task ${creep.v5task.constructor.name}`
    }
    if (!isV5CreepMemory(creep.memory)) {
      return `Creep ${creepName} is not v5`
    }
    creep.memory.t = MoveToRoomTask.create(roomName, waypoints).encode()

    return "ok"
  }

  private transfer(): CommandExecutionResult {
    const args = this.parseProcessArguments("creep_name", "target_id")
    if (typeof args === "string") {
      return args
    }
    const [creepName, targetId] = args
    if (creepName == null || targetId == null) {
      return ""
    }

    const creep = Game.creeps[creepName]
    if (creep == null) {
      return `Creep ${creepName} doesn't exists`
    }
    if (creep.v5task != null) {
      return `Creep ${creepName} has v5 task ${creep.v5task.constructor.name}`
    }
    const target = Game.getObjectById(targetId) as TransferResourceApiWrapperTargetType | null
    if (target == null) {
      return `Target ${targetId} does not exists`
    }

    if (!isV5CreepMemory(creep.memory)) {
      return `Creep ${creepName} is not v5`
    }
    creep.memory.t = MoveToTargetTask.create(TransferResourceApiWrapper.create(target, RESOURCE_POWER)).encode()
    return "ok"
  }

  private pickup(): CommandExecutionResult {
    const args = this.parseProcessArguments("creep_name", "target_id")
    if (typeof args === "string") {
      return args
    }
    const [creepName, targetId] = args
    if (creepName == null || targetId == null) {
      return ""
    }

    const creep = Game.creeps[creepName]
    if (creep == null) {
      return `Creep ${creepName} doesn't exists`
    }
    // if (creep.v5task != null) {
    //   return `Creep ${creepName} has v5 task ${creep.v5task.constructor.name}`
    // }
    const target = Game.getObjectById(targetId) as Resource | null
    if (target == null) {
      return `Target ${targetId} does not exists`
    }

    if (!isV5CreepMemory(creep.memory)) {
      return `Creep ${creepName} is not v5`
    }
    const tasks: CreepTask[] = [
      MoveToTargetTask.create(PickupApiWrapper.create(target)),
    ]
    if (target.room != null) {
      tasks.unshift(MoveToRoomTask.create(target.room.name, []))
    }
    creep.memory.t = SequentialTask.create(tasks, {ignoreFailure: true, finishWhenSucceed: false}).encode()
    return "ok"
  }

  private resource(): CommandExecutionResult {
    const args = [...this.args]
    args.splice(0, 1)

    const command = args[0]
    switch (command) {
    case "room":
      if (args[1] == null || !isResourceConstant(args[1])) {
        return `Invalid resource type ${args[1]}`
      }
      return this.resourceInRoom(args[1])
    case "list":
    default:
      return this.listResource()
    }
  }

  private listResource(): CommandExecutionResult {
    const resources = ResourceManager.list()
    // const resourceTypes = Array.from(resources.keys()).sort()  // TODO:
    resources.forEach((amount, resourceType) => {
      const amountDescription = ((): string => {
        return `${amount}`  // TODO: format
      })()
      PrimitiveLogger.log(`${coloredResourceType(resourceType)}: ${amountDescription}`)
    })
    return "ok"
  }

  private resourceInRoom(resourceType: ResourceConstant): CommandExecutionResult {
    const resourceInRoom = ResourceManager.resourceInRoom(resourceType)
    PrimitiveLogger.log(`${coloredResourceType(resourceType)}: `)
    resourceInRoom.forEach((amount, roomName) => {
      PrimitiveLogger.log(`- ${roomLink(roomName)}: ${amount}`)
    })
    return "ok"
  }
}
