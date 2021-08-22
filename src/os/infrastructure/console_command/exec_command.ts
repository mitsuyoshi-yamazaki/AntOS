import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { findPath, findPathToSource, placeRoadConstructionMarks, showCachedSourcePath } from "script/pathfinder"
import { describeLabs, placeOldRoomPlan, showOldRoomPlan, showRoomPlan } from "script/room_plan"
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
import { isRoomName, RoomName } from "utility/room_name"
import { RoomResources } from "room_resource/room_resources"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"

export class ExecCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    switch (this.args[0]) {
    case "findPath":
      return this.findPath()
    case "findPathToSource":
      return this.findPathToSource()
    case "showCachedSourcePath":
      return this.showCachedSourcePath()
    case "showOldRoomPlan":
      return this.showOldRoomPlan()
    case "placeOldRoomPlan":
      return this.placeOldRoomPlan()
    case "placeRoadConstructionMarks":
      return this.placeRoadConstructionMarks()
    case "showPositionsInRange":
      return this.showPositionsInRange()
    case "describeLabs":
      return this.describeLabs()
    case "moveToRoom":
      return this.moveToRoom()
    case "transfer":
      return this.transfer()
    case "pickup":
      return this.pickup()
    case "resource":
      return this.resource()
    case "set_boost_labs":
      return this.setBoostLabs()
    case "show_room_plan":
      return this.showRoomPlan()
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
    // if (creep.v5task != null) {
    //   return `Creep ${creepName} has v5 task ${creep.v5task.constructor.name}`
    // }
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
    const apiWrapper = ((): PickupApiWrapper | WithdrawResourceApiWrapper | string => {
      const target = Game.getObjectById(targetId)
      if (target == null) {
        return `Target ${targetId} does not exists`
      }
      if (target instanceof Resource) {
        return PickupApiWrapper.create(target)
      }
      if ((target instanceof Tombstone) && target.store.getUsedCapacity(RESOURCE_POWER) > 0 ) {
        return WithdrawResourceApiWrapper.create(target, RESOURCE_POWER)
      }
      return `Unsupported target type ${target}`
    })()

    if (typeof apiWrapper === "string") {
      return apiWrapper
    }

    if (!isV5CreepMemory(creep.memory)) {
      return `Creep ${creepName} is not v5`
    }
    const tasks: CreepTask[] = [
      MoveToTargetTask.create(apiWrapper),
    ]
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
    case "collect": {
      if (args[1] == null || !isResourceConstant(args[1])) {
        return `Invalid resource type ${args[1]}`
      }
      if (args[2] == null || !isRoomName(args[2])) {
        return `Invalid room name ${args[2]}`
      }
      const amount = ((): number | string | null => {
        if (args[3] == null) {
          return null
        }
        const parsed = parseInt(args[3], 10)
        if (isNaN(parsed) === true) {
          return `amount is not a number ${args[3]}`
        }
        return parsed
      })()
      if (typeof amount === "string") {
        return amount
      }
      return this.collectResource(args[1], args[2], amount ?? "all")
    }
    case "list":
    default:
      return this.listResource()
    }
  }

  private listResource(): CommandExecutionResult {
    const isLowercase = (value: string): boolean => (value === value.toLocaleLowerCase())
    const resources = Array.from(ResourceManager.list().entries()).sort(([lhs], [rhs]) => {
      const lowerL = isLowercase(lhs)
      const lowerR = isLowercase(rhs)
      if (lowerL === true && lowerR === true) {
        return rhs.length - lhs.length
      }
      if (lowerL === false && lowerR === false) {
        return lhs.length - rhs.length
      }
      return lowerL === true ? -1 : 1
    })
    resources.forEach(([resourceType, amount]) => {
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

  private collectResource(resourceType: ResourceConstant, destinationRoomName: RoomName, amount: number | "all"): CommandExecutionResult {
    const resources = RoomResources.getOwnedRoomResource(destinationRoomName)
    if (resources == null) {
      return `${this.constructor.name} collectResource() cannot retrieve owned room resources from ${roomLink(destinationRoomName)}`
    }
    if (resources.activeStructures.terminal == null) {
      return `${this.constructor.name} collectResource() no active terminal found in ${roomLink(destinationRoomName)}`
    }
    if (amount === "all") {
      const resourceAmount = ResourceManager.amount(resourceType)
      if (resources.activeStructures.terminal.store.getFreeCapacity() <= (resourceAmount + 10000)) {
        return `${this.constructor.name} collectResource() not enough free space ${roomLink(destinationRoomName)} (${resourceAmount} ${coloredResourceType(resourceType)})`
      }
    } else {
      if (resources.activeStructures.terminal.store.getFreeCapacity() <= (amount + 10000)) {
        return `${this.constructor.name} collectResource() not enough free space ${roomLink(destinationRoomName)}`
      }
    }

    const result = ResourceManager.collect(resourceType, destinationRoomName, amount)
    switch (result.resultType) {
    case "succeeded":
      return `${result.value} ${coloredResourceType(resourceType)} sent to ${roomLink(destinationRoomName)}`
    case "failed":
      return result.reason
    }
  }

  // Game.io("exec set_boost_labs room_name=W9S24 labs=60f967be396ad538632751b5,60f92938993e4f921d6487aa,6106ee55706bd84a378e1ee7,61073ced8f86f51bf3f51e78,610711ff76863065bc6e1410")
  // Game.io("exec set_boost_labs room_name=W21S23 labs=61084244e3f522438c8577a0,610d4472e3f5226d9687a54c,610d21b256c81947c9e72d78,6118cc28e1d3505dfdaa0e55,61085d0c464512bdf3c72008,611855a895328ffc2e83e8d2")
  // Game.io("exec set_boost_labs room_name=W6S29 labs=6111e92d9c09be5e07e92f70,6111d8c310194018d132a7f7,611207e4c7daf842982fe70a,61122f11f72716515c8a5dce,61125d5eaa2f2224b1896196")
  private setBoostLabs(): CommandExecutionResult {
    const outputs: string[] = []

    const args = this._parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const rawLabs = args.get("labs")
    if (rawLabs == null) {
      return this.missingArgumentError("labs")
    }
    const labIds: Id<StructureLab>[] = []
    for (const labId of rawLabs.split(",")) {
      const lab = Game.getObjectById(labId)
      if (!(lab instanceof StructureLab)) {
        return `Id ${labId} is not lab ${lab}`
      }
      if (lab.room.name !== roomName) {
        return `Lab ${lab} is not in ${roomLink(roomName)}`
      }
      labIds.push(lab.id)
    }

    const resources = RoomResources.getOwnedRoomResource(roomName)
    if (resources == null) {
      return `Room ${roomName} is not owned`
    }
    const researchLab = resources.roomInfo.researchLab
    if (researchLab != null) {
      for (const labId of labIds) {
        if (labId === researchLab.inputLab1 || labId === researchLab.inputLab2) {
          return `Lab ${labId} is set for research input lab ${roomLink(roomName)}`
        }
        const index = researchLab.outputLabs.indexOf(labId)
        if (index < 0) {
          continue
        }
        researchLab.outputLabs.splice(index, 1)
        outputs.push(`Lab ${labId} is removed from research output lab`)
      }
    }

    if (resources.roomInfo.config == null) {
      resources.roomInfo.config = {}
      outputs.push("Add roomInfo.config")
    }
    if (resources.roomInfo.config.boostLabs != null && resources.roomInfo.config.boostLabs.length > 0) {
      outputs.push(`Overwrite boostLabs ${resources.roomInfo.config.boostLabs.length} labs -> ${labIds.length} labs`)
    } else {
      outputs.push(`Set ${labIds.length} labs`)
    }
    resources.roomInfo.config.boostLabs = labIds

    return `\n${outputs.join("\n")}`
  }

  private showRoomPlan(): CommandExecutionResult {
    const args = this._parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const room = Game.rooms[roomName]
    if (room == null) {
      return `No visible to ${roomLink(roomName)}`
    }

    return showRoomPlan(room)
  }
}
