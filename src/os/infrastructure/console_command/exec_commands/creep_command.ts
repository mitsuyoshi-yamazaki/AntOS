import { GameMap } from "game/game_map"
import { isV5CreepMemory } from "prototype/creep"
import { coloredResourceType, roomLink } from "utility/log"
import type { RoomName } from "shared/utility/room_name_types"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawApiWrapper, WithdrawApiWrapperTargetType } from "v5_object_task/creep_task/api_wrapper/withdraw_api_wrapper"
import { MoveToInvisibleTargetTask } from "v5_object_task/creep_task/combined_task/move_to_invisible_target_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { ListArguments } from "../../../../shared/utility/argument_parser/list_argument_parser"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { decodeRoomPosition } from "prototype/room_position"

/** @throws */
export function execCreepCommand(creep: Creep, args: string[]): string {
  const commandList = ["help", "pickup", "transfer", "bring_back", "move_to_room", "move_to"]
  const listArguments = new ListArguments(args)

  const command = listArguments.string(0, "command").parse()
  args.shift()

  switch (command) {
  case "help":
    return `Commands: ${commandList}`
  case "pickup":
    return pickup(creep, args)
  case "transfer":
    return transfer(creep, args)
  case "bring_back":
    // return bringBack(creep, args)
    throw "not implemented yet"
  case "move_to_room":
    return moveToRoom(creep, args)
  case "move_to":
    return moveTo(creep, args)
  default:
    throw `Invalid command ${command}. see "help"`
  }
}

/** @throws */
const moveTo = (creep: Creep, args: string[]): string => {
  if (!isV5CreepMemory(creep.memory)) {
    throwNotV5Error(creep)
  }

  const listArguments = new ListArguments(args)
  const position = listArguments.localPosition(0, "position").parse()
  const roomPosition = decodeRoomPosition(position, creep.room.name)

  creep.memory.t = MoveToTask.create(roomPosition, 0).encode()
  return `${creep.name} move to ${roomPosition}`
}

type PickupTargetType = Tombstone | Ruin | StructureContainer | StructureTower | StructureLab
function isPickupTargetType(roomObject: RoomObject): roomObject is PickupTargetType {
  if (roomObject instanceof Tombstone) {
    return true
  }
  if (roomObject instanceof Ruin) {
    return true
  }
  if (roomObject instanceof StructureContainer) {
    return true
  }
  if (roomObject instanceof StructureTower) {
    return true
  }
  if (roomObject instanceof StructureLab) {
    return true
  }
  return false
}

function throwNotV5Error(creep: Creep): never {
  throw `Creep ${creep.name} ${creep.pos} in ${roomLink(creep.room.name)} is not v5`
}

/**
 * @throws
 * targetの全resourceをwithdrawするはず
 */
function pickup(creep: Creep, args: string[]): string {
  if (!isV5CreepMemory(creep.memory)) {
    throwNotV5Error(creep)
  }

  const listArguments = new ListArguments(args)
  const targetId = listArguments.gameObjectId(0, "target ID").parse() as Id<RoomObject>
  const task = createPickupTask(
    creep,
    targetId,
    () => listArguments.roomName(1, "target room name", { missingArgumentErrorMessage: `target with ID ${targetId} is not visible. specify target room name` }).parse(),
  )

  creep.memory.t = task.encode()
  return "ok"
}

/** @throws */
function createPickupTask(creep: Creep, pickupTargetId: Id<RoomObject>, getPickupTargetRoomName: () => RoomName): MoveToInvisibleTargetTask | MoveToTargetTask {
  const target = Game.getObjectById(pickupTargetId)

  if (target == null) {
    const targetRoomName = getPickupTargetRoomName()
    const waypoints = GameMap.getWaypoints(creep.room.name, targetRoomName) ?? []
    return MoveToInvisibleTargetTask.create(targetRoomName, waypoints, {
      case: "withdraw",
      targetId: pickupTargetId as Id<WithdrawApiWrapperTargetType>,
    })
  }

  if (!(isPickupTargetType(target))) { // target != null
    throw `${target} is not pickup target type`
  }

  return MoveToTargetTask.create(WithdrawApiWrapper.create(target))
}

/** @throws */
function moveToRoom(creep: Creep, args: string[]): string {
  if (!isV5CreepMemory(creep.memory)) {
    throwNotV5Error(creep)
  }

  const listArguments = new ListArguments(args)
  const destinationRoomName = listArguments.roomName(0, "destination room name").parse()

  const waypoints = ((): RoomName[] => {
    if (listArguments.has(1) === true) {
      const waypointsArgument = listArguments.list(1, "waypoints", "room_name").parse()
      if (GameMap.hasWaypoints(creep.room.name, destinationRoomName) !== true) {
        GameMap.setWaypoints(creep.room.name, destinationRoomName, waypointsArgument)
      }
      return waypointsArgument
    }
    const stored = GameMap.getWaypoints(creep.room.name, destinationRoomName, { ignoreMissingWaypoints: true })
    if (stored == null) {
      throw `waypoints not given and waypoints from ${roomLink(creep.room.name)} to ${roomLink(destinationRoomName)} is not stored`
    }
    return stored
  })()

  creep.memory.t = MoveToRoomTask.create(destinationRoomName, waypoints).encode()

  return "ok"
}

type TransferTargetType = StructureStorage | StructureTerminal
function isTransferTargetType(roomObject: RoomObject): roomObject is TransferTargetType {
  if (roomObject instanceof StructureStorage) {
    return true
  }
  if (roomObject instanceof StructureTerminal) {
    return true
  }
  return false
}

/** @throws */
function transfer(creep: Creep, args: string[]): string {
  if (!isV5CreepMemory(creep.memory)) {
    throwNotV5Error(creep)
  }

  const listArguments = new ListArguments(args)
  const targetId = listArguments.gameObjectId(0, "target ID").parse() as Id<RoomObject>

  const target = Game.getObjectById(targetId)
  if (target == null) {
    throw `target ${targetId} invisible`
  }
  if (!(isTransferTargetType(target))) {
    throw `${target} is not transfer target`
  }

  const resourceTypes = Object.keys(creep.store) as ResourceConstant[]
  if (resourceTypes.length <= 0) {
    throw "nothing to transfer"
  }

  const tasks = resourceTypes.map(resourceType => MoveToTargetTask.create(TransferResourceApiWrapper.create(target, resourceType)))
  creep.memory.t = SequentialTask.create(tasks, { finishWhenSucceed: false, ignoreFailure: false }).encode()
  return `transfer ${resourceTypes.map(resourceType => coloredResourceType(resourceType)).join(",")}`
}

// /** @throws */
// function bringBack(creep: Creep, args: string[]): string {
//   const listArguments = new ListArguments(args)
//   const keywordArguments = new KeywordArguments(args)

//   const pickupTargetId = listArguments.gameObjectId(0, "pickup target ID").parse() as Id<RoomObject>
//   const pickupTask = createPickupTask(
//     creep,
//     pickupTargetId,
//     () => keywordArguments.roomName("pickup_target_room_name", { missingArgumentErrorMessage: `target with ID ${pickupTargetId} is not visible. specify target room name` }).parse(),
//   )

//   const tasks: CreepTask[] = [
//     pickupTask,
//   ]

//   // TODO: この時点ではCreepが何のResourceを保有するかわからない
// }

// function moveCreep(): CommandExecutionResult {
//   const args = this.parseProcessArguments("creep_name", "waypoints")
//   if (typeof args === "string") {
//     return args
//   }
//   const [creepName, rawWaypoints] = args
//   if (creepName == null || rawWaypoints == null) {
//     return ""
//   }
//   const creep = Game.creeps[creepName]
//   if (creep == null) {
//     return `Creep ${creepName} doesn't exists`
//   }
//   const roomName = creep.room.name

//   const waypoints: RoomPosition[] = []
//   const errors: string[] = []
//   rawWaypoints.split(",").forEach(waypoint => {
//     const components = waypoint.split(";")
//     if (components.length !== 2 || components[0] == null || components[1] == null) {
//       errors.push(`Invalid waypoint ${waypoint}`)
//       return
//     }
//     const x = parseInt(components[0], 10)
//     const y = parseInt(components[1], 10)
//     if (isNaN(x) === true || isNaN(y) === true) {
//       errors.push(`Invalid waypoint ${waypoint}`)
//       return
//     }
//     try {
//       waypoints.push(new RoomPosition(x, y, roomName))
//     } catch (e) {
//       errors.push(`Cannot create RoomPosition for ${waypoint}`)
//     }
//   })

//   if (errors.length > 0) {
//     return errors.join(", ")
//   }

//   if (!isV5CreepMemory(creep.memory)) {
//     return `Creep ${creepName} is not v5`
//   }
//   const moveTasks = waypoints.map(waypoint => MoveToTask.create(waypoint, 0))
//   creep.memory.t = V5SequentialTask.create(moveTasks, { ignoreFailure: false, finishWhenSucceed: false }).encode()

//   return "ok"
// }
