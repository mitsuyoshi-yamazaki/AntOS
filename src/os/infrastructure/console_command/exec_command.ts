import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { calculateInterRoomShortestRoutes, placeRoadConstructionMarks, getRoadPositionsToParentRoom, calculateRoadPositionsFor } from "script/pathfinder"
import { describeLabs, showRoomPlan } from "script/room_plan"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask as MoveToTargetTaskV5 } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { TransferResourceApiWrapper, TransferResourceApiWrapperTargetType } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { isV5CreepMemory, isV6CreepMemory } from "prototype/creep"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { ResourceManager } from "utility/resource_manager"
import { PrimitiveLogger } from "../primitive_logger"
import { coloredResourceType, coloredText, roomLink, Tab, tab } from "utility/log"
import { isResourceConstant } from "utility/resource"
import { isRoomName, RoomName } from "utility/room_name"
import { RoomResources } from "room_resource/room_resources"
import { MoveToTargetTask } from "object_task/creep_task/task/move_to_target_task"
import { TransferApiWrapper } from "object_task/creep_task/api_wrapper/transfer_api_wrapper"
import { WithdrawApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_api_wrapper"
import { DismantleApiWrapper } from "v5_object_task/creep_task/api_wrapper/dismantle_api_wrapper"
import { Process } from "process/process"
import { OperatingSystem } from "os/os"
import { V6RoomKeeperProcess } from "process/process/v6_room_keeper_process"
import { Season1838855DistributorProcess } from "process/temporary/season_1838855_distributor_process"
import { Season2055924SendResourcesProcess } from "process/temporary/season_2055924_send_resources_process"
import { Season1143119LabChargerProcess } from "process/temporary/season_1143119_lab_charger_process"
import { RoomKeeperProcess } from "process/process/room_keeper_process"
import { calculateWallPositions } from "script/wall_builder"
import { decodeRoomPosition } from "prototype/room_position"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { temporaryScript } from "../../../../submodules/attack/script/temporary_script"
import { KeywordArguments } from "./utility/keyword_argument_parser"
import { DefenseRoomProcess } from "process/process/defense/defense_room_process"
import { DefenseRemoteRoomProcess } from "process/process/defense_remote_room_process"
import { World35587255ScoutRoomProcess } from "process/temporary/world_35587255_scout_room_process"
import { execPowerCreepCommand } from "./exec_commands/power_creep_command"
import { ListArguments } from "./utility/list_argument_parser"
import { execRoomConfigCommand } from "./exec_commands/room_config_command"

export class ExecCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    try {
      const args = [...this.args]
      const scriptType = args.shift()
      switch (scriptType) {
      case "show_remote_route":
        return this.showRemoteRoute()
      case "calculate_inter_room_shortest_routes":
        return this.calculateInterRoomShortestRoutes()
      case "roads_to_parent_room":
        return this.getRoadPositionsToParentRoom()
      case "describeLabs":
        return this.describeLabs()
      case "moveToRoom":
        return this.moveToRoom()
      case "move":
        return this.moveCreep()
      case "transfer":
        return this.transfer()
      case "pickup":
        return this.pickup()
      case "dismantle":
        return this.dismantle()
      case "resource":
        return this.resource()
      case "set_boost_labs":
        return this.setBoostLabs()
      case "set_waiting_position":
        return this.setWaitingPosition()
      case "show_room_plan":
        return this.showRoomPlan()
      case "show_wall_plan":
        return this.showWallPlan()
      case "mineral":
        return this.showHarvestableMinerals()
      case "room_config":
        return this.configureRoomInfo(args)
      case "check_alliance":
        return this.checkAlliance()
      case "unclaim":
        return this.unclaim()
      case "power_creep":
        return this.powerCreep(args)
      case "script":
        return this.runScript()
      default:
        throw `Invalid script type ${scriptType}`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
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
  /** throws */
  private showRemoteRoute(): CommandExecutionResult {
    const keywardArguments = new KeywordArguments(this.args)
    const startObjectId = keywardArguments.gameObjectId("start_object_id").parse()
    const startObject = Game.getObjectById(startObjectId)
    if (!(startObject instanceof RoomObject)) {
      throw `${startObject} is not RoomObject ${startObjectId}`
    }

    const goalObjectId = keywardArguments.gameObjectId("goal_object_id").parse()
    const goalObject = Game.getObjectById(goalObjectId)
    if (!(goalObject instanceof RoomObject)) {
      throw `${goalObject} is not RoomObject ${goalObjectId}`
    }

    const usePrimitiveFunction = keywardArguments.boolean("primitive").parseOptional()
    if (usePrimitiveFunction === true) {
      const result = calculateRoadPositionsFor(startObject.pos, goalObject.pos)
      switch (result.resultType) {
      case "succeeded":
        result.value.forEach(position => {
          const room = Game.rooms[position.roomName]
          if (room == null) {
            return
          }
          room.visual.text("@", position.x, position.y, {color: "#FF0000"})
        })
        return `${result.value.length} roads`
      case "failed":
        throw result.reason
      }
    }

    const dryRun = true

    const result = placeRoadConstructionMarks(startObject.pos, goalObject.pos, "manual", { dryRun })
    switch (result.resultType) {
    case "succeeded":
      return "ok"
    case "failed":
      throw result.reason
    }
  }

  /** throws */
  private calculateInterRoomShortestRoutes(): CommandExecutionResult {
    const keywardArguments = new KeywordArguments(this.args)
    const fromRoomName = keywardArguments.roomName("from_room_name").parse()
    const toRoomName = keywardArguments.roomName("to_room_name").parse()

    const routes = calculateInterRoomShortestRoutes(fromRoomName, toRoomName)
    if (routes.length <= 0) {
      throw `no route from ${roomLink(fromRoomName)} =&gt ${roomLink(toRoomName)}`
    }

    const descriptions: string[] = [
      `${routes.length} routes found from ${roomLink(fromRoomName)} =&gt ${roomLink(toRoomName)}`,
      ...routes.map(route => route.map(r => roomLink(r)).join(" =&gt ")),
    ]
    return descriptions.join("\n")
  }

  /** throws */
  private getRoadPositionsToParentRoom(): CommandExecutionResult {
    const keywardArguments = new KeywordArguments(this.args)
    const parentRoomName = keywardArguments.roomName("parent_room_name").parse()
    const targetRoom = keywardArguments.room("target_room_name").parse()

    const positions = getRoadPositionsToParentRoom(parentRoomName, targetRoom)
    if (positions.length <= 0) {
      return `no roads on the edge of the parent room in ${roomLink(targetRoom.name)} to parent ${roomLink(parentRoomName)}`
    }

    positions.forEach(position => targetRoom.visual.text("#", position.x, position.y, {color: "#FF0000"}))
    return `${positions.length} road found: ${positions.map(position => `${position}`).join(", ")}`
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

  private moveCreep(): CommandExecutionResult {
    const args = this.parseProcessArguments("creep_name", "waypoints")
    if (typeof args === "string") {
      return args
    }
    const [creepName, rawWaypoints] = args
    if (creepName == null || rawWaypoints == null) {
      return ""
    }
    const creep = Game.creeps[creepName]
    if (creep == null) {
      return `Creep ${creepName} doesn't exists`
    }
    const roomName = creep.room.name

    const waypoints: RoomPosition[] = []
    const errors: string[] = []
    rawWaypoints.split(",").forEach(waypoint => {
      const components = waypoint.split(";")
      if (components.length !== 2 || components[0] == null || components[1] == null) {
        errors.push(`Invalid waypoint ${waypoint}`)
        return
      }
      const x = parseInt(components[0], 10)
      const y = parseInt(components[1], 10)
      if (isNaN(x) === true || isNaN(y) === true) {
        errors.push(`Invalid waypoint ${waypoint}`)
        return
      }
      try {
        waypoints.push(new RoomPosition(x, y, roomName))
      } catch (e) {
        errors.push(`Cannot create RoomPosition for ${waypoint}`)
      }
    })

    if (errors.length > 0) {
      return errors.join(", ")
    }

    if (!isV5CreepMemory(creep.memory)) {
      return `Creep ${creepName} is not v5`
    }
    const moveTasks = waypoints.map(waypoint => MoveToTask.create(waypoint, 0))
    creep.memory.t = SequentialTask.create(moveTasks, {ignoreFailure: false, finishWhenSucceed: false}).encode()

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
    // if (creep.v5task != null) {
    //   return `Creep ${creepName} has v5 task ${creep.v5task.constructor.name}`
    // }
    const target = Game.getObjectById(targetId) as TransferResourceApiWrapperTargetType | null
    if (target == null) {
      return `Target ${targetId} does not exists`
    }

    const resourceType = Object.keys(creep.store)[0] as ResourceConstant | null
    if (resourceType == null) {
      return "nothing to transfer"
    }
    if (!isResourceConstant(resourceType)) {
      return `${resourceType} is not resource type`
    }
    if (isV5CreepMemory(creep.memory)) {
      creep.memory.t = MoveToTargetTaskV5.create(TransferResourceApiWrapper.create(target, resourceType)).encode()
      return `transfer ${resourceType}`
    }
    if (isV6CreepMemory(creep.memory)) {
      creep.memory.t = MoveToTargetTask.create(TransferApiWrapper.create(target, resourceType)).encode()
      return `transfer ${resourceType}`
    }
    return `Creep ${creepName} is not neither v5 or v6`
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
    const apiWrapper = ((): WithdrawApiWrapper | string => {
      const target = Game.getObjectById(targetId)
      if (target == null) {
        return `Target ${targetId} does not exists`
      }
      if (target instanceof Resource) {
        return WithdrawApiWrapper.create(target)
      }
      if (!(target instanceof Tombstone) && !(target instanceof StructureContainer) && !(target instanceof Ruin)) {
        return `Unsupported target type ${target}`
      }
      if (target.store.getUsedCapacity() > 0 ) {
        return WithdrawApiWrapper.create(target)
      }
      return `Nothing to pickup ${target}`
    })()

    if (typeof apiWrapper === "string") {
      return apiWrapper
    }

    if (!isV5CreepMemory(creep.memory)) {
      return `Creep ${creepName} is not v5`
    }
    const tasks: CreepTask[] = [
      MoveToTargetTaskV5.create(apiWrapper),
    ]
    creep.memory.t = SequentialTask.create(tasks, {ignoreFailure: true, finishWhenSucceed: false}).encode()
    return "ok"
  }

  private dismantle(): CommandExecutionResult {
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
    const apiWrapper = ((): DismantleApiWrapper | string => {
      const target = Game.getObjectById(targetId)
      if (target == null) {
        return `Target ${targetId} does not exists`
      }
      if (target instanceof StructureWall) {
        return DismantleApiWrapper.create(target)
      }
      return `${target} is not supported yet`
    })()

    if (typeof apiWrapper === "string") {
      return apiWrapper
    }

    if (!isV5CreepMemory(creep.memory)) {
      return `Creep ${creepName} is not v5`
    }
    const tasks: CreepTask[] = [
      MoveToTargetTaskV5.create(apiWrapper),
    ]
    creep.memory.t = SequentialTask.create(tasks, { ignoreFailure: true, finishWhenSucceed: false }).encode()
    return "ok"
  }

  private resource(): CommandExecutionResult {
    const commandList = ["help", "room", "collect", "list"]
    const args = [...this.args]
    args.splice(0, 1)

    const command = args[0]
    switch (command) {
    case "help":
      return `commands: ${commandList}`
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
      if (args[3] == null) {
        return "amout is missing (number or \"all\")"
      }
      const rawAmount = args[3]
      const amount = ((): number | "all" | null => {
        if (rawAmount === "all") {
          return "all"
        }
        const parsed = parseInt(rawAmount, 10)
        if (isNaN(parsed) === true) {
          return null
        }
        return parsed
      })()
      if (amount == null) {
        return `Invalid amount ${args[3]} (number or "all")`
      }

      return this.collectResource(args[1], args[2], amount)
    }
    case "list":
      return this.listResource()

    default:
      return `invalid command: ${command}, "help" to show manual`
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

  // Game.io("exec set_boost_labs room_name=W53S36 total_boost_lab_count=6")
  private setBoostLabs(): CommandExecutionResult {
    const outputs: string[] = []

    const args = this._parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }

    const resources = RoomResources.getOwnedRoomResource(roomName)
    if (resources == null) {
      return `Room ${roomLink(roomName)} is not owned`
    }

    const rawTotalBoostLabCount = args.get("total_boost_lab_count")
    if (rawTotalBoostLabCount == null) {
      return this.missingArgumentError("total_boost_lab_count")
    }
    const totalBoostLabCount = parseInt(rawTotalBoostLabCount)
    if (isNaN(totalBoostLabCount) === true) {
      return `total_boost_lab_count is not a number ${rawTotalBoostLabCount}`
    }

    if ((resources.roomInfo.config?.boostLabs?.length ?? 0) >= totalBoostLabCount) {
      return `${roomLink(roomName)} has boost labs`
    }

    const numberOfBoostLabs = ((): number => {
      const boostLabs = resources.roomInfo.config?.boostLabs
      if (boostLabs != null) {
        return Math.max(totalBoostLabCount - boostLabs.length, 0)
      }
      return totalBoostLabCount
    })()

    const researchLab = resources.roomInfo.researchLab
    const boostLabIds: Id<StructureLab>[] = []

    if (researchLab != null) {
      const outputLabs = [...researchLab.outputLabs]
        .flatMap(labId => {
          const lab = Game.getObjectById(labId)
          if (lab == null) {
            PrimitiveLogger.programError(`setBoostLabs() lab with ID ${labId} not found in ${roomLink(roomName)}`)
            return []
          }
          return lab
        })

      if (resources.roomInfo.roomPlan?.centerPosition != null) {
        const centerPosition = decodeRoomPosition(resources.roomInfo.roomPlan.centerPosition, roomName)
        outputLabs.sort((lhs, rhs) => {
          return centerPosition.getRangeTo(lhs) - centerPosition.getRangeTo(rhs)
        })
      }

      if (outputLabs.length > numberOfBoostLabs) {
        outputLabs.splice(numberOfBoostLabs, outputLabs.length - numberOfBoostLabs)
      }
      boostLabIds.push(...outputLabs.map(lab => lab.id))
      boostLabIds.forEach(labId => {
        const index = researchLab.outputLabs.indexOf(labId)
        if (index < 0) {
          return
        }
        researchLab.outputLabs.splice(index, 1)
      })
      outputs.push(`Removed from research output lab: ${boostLabIds}`)

    } else {  // researchLab == null
      const labs = ((): StructureLab[] => {
        const foundLabs = resources.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[]
        if (resources.roomInfo.config?.boostLabs == null) {
          return foundLabs
        }
        const storedBoostLabIds = [...resources.roomInfo.config.boostLabs]
        return foundLabs.filter(lab => storedBoostLabIds.includes(lab.id) !== true)
      })()
      if (labs.length > numberOfBoostLabs) {
        labs.splice(numberOfBoostLabs, labs.length - numberOfBoostLabs)
      }
      boostLabIds.push(...labs.map(lab => lab.id))

      if (boostLabIds.length > 0) {
        outputs.push(`Found ${boostLabIds.length} unused labs`)
      }
    }

    if (resources.roomInfo.config == null) {
      resources.roomInfo.config = {}
      outputs.push("Add roomInfo.config")
    }
    if (resources.roomInfo.config.boostLabs != null && resources.roomInfo.config.boostLabs.length > 0) {
      outputs.push(`Overwrite boostLabs ${resources.roomInfo.config.boostLabs.length} labs -> ${boostLabIds.length} labs`)
    } else {
      outputs.push(`Set ${boostLabIds.length} labs`)
    }
    if (resources.roomInfo.config.boostLabs == null) {
      resources.roomInfo.config.boostLabs = boostLabIds
    } else {
      resources.roomInfo.config.boostLabs.push(...boostLabIds)
    }

    return `\n${outputs.join("\n")}`
  }

  // Game.io("exec set_waiting_position room_name=W52S25 pos=35,21")
  private setWaitingPosition(): CommandExecutionResult {
    const args = this._parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const resources = RoomResources.getOwnedRoomResource(roomName)
    if (resources == null) {
      return `${roomLink(roomName)} is not owned`
    }
    const rawPosition = args.get("pos")
    if (rawPosition == null) {
      return this.missingArgumentError("pos")
    }
    const [rawX, rawY] = rawPosition.split(",")
    if (rawX == null || rawY == null) {
      return `Invalid position format: ${rawPosition}, expected pos=x,y`
    }
    const x = parseInt(rawX, 10)
    const y = parseInt(rawY, 10)
    if (isNaN(x) === true || isNaN(y) === true) {
      return `Position is not a number: ${rawPosition}`
    }
    try {
      new RoomPosition(x, y, roomName)
      if (resources.roomInfo.config == null) {
        resources.roomInfo.config = {}
      }
      resources.roomInfo.config.waitingPosition = {
        x,
        y,
      }
      return `Waiting position in ${roomLink(roomName)} set`
    } catch (e) {
      return `Invalid position: ${e} (${rawPosition}, ${roomLink(roomName)})`
    }
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
    const controller = room.controller
    if (controller == null) {
      return `No controller in ${roomLink(roomName)}`
    }
    const dryRun = (args.get("dry_run") ?? "1") === "1"
    const showsCostMatrix = (args.get("show_cost_matrix") ?? "0") === "1"

    return showRoomPlan(controller, dryRun, showsCostMatrix)
  }

  private showWallPlan(): CommandExecutionResult {
    const args = this._parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const room = Game.rooms[roomName]
    if (room == null) {
      return `No visible to ${roomLink(roomName)}`
    }
    const showsCostMatrix = (args.get("show_cost_matrix") ?? "0") === "1"
    return this.showWallPlanOf(room, showsCostMatrix)
  }

  private showWallPlanOf(room: Room, showsCostMatrix: boolean): CommandExecutionResult {
    const roomName = room.name

    if (showsCostMatrix !== true) {
      const roomResource = RoomResources.getOwnedRoomResource(roomName)
      const storedWallPositions = roomResource?.roomInfo.roomPlan?.wallPositions
      if (storedWallPositions != null) {
        if (storedWallPositions.length <= 0) {
          return `Wall already placed in ${roomLink(roomName)}`
        }
        storedWallPositions.forEach(wallPosition => {
          const wallType = ((): string => {
            switch (wallPosition.wallType) {
            case STRUCTURE_WALL:
              return "W"
            case STRUCTURE_RAMPART:
              return "R"
            }
          })()
          room.visual.text(wallType, wallPosition.x, wallPosition.y, { color: "#FF0000" })
        })
        return "ok"
      }
    }

    const wallPositions = calculateWallPositions(room, showsCostMatrix)
    if (typeof wallPositions === "string") {
      return wallPositions
    }

    return `${wallPositions.length} walls`
  }

  private showHarvestableMinerals(): CommandExecutionResult {
    const harvestableMinerals = ResourceManager.harvestableMinerals()
    const result: string[] = []
    result.push("Harvestable:")
    result.push(...Array.from(harvestableMinerals.owned.entries()).map(([resourceType, roomNames]) => `- ${coloredResourceType(resourceType)}: ${roomNames.map(r => roomLink(r)).join(", ")}`))
    result.push("Harvestable in SK rooms:")
    result.push(...Array.from(harvestableMinerals.sourceKeeper.entries()).map(([resourceType, roomNames]) => `- ${coloredResourceType(resourceType)}: ${roomNames.map(r => roomLink(r)).join(", ")}`))
    result.push("Not harvestable:")
    result.push(harvestableMinerals.notHarvestable.map(r => coloredResourceType(r)).join(","))
    return `\n${result.join("\n")}`
  }

  private configureRoomInfo(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const roomResource = listArguments.ownedRoomResource(0, "room name").parse()
    return execRoomConfigCommand(roomResource, args)
  }

  private checkAlliance(): CommandExecutionResult {
    const playerName = this.args[1]
    if (playerName == null || playerName.length <= 0) {
      return "No playername"
    }
    const LOANuser = "LeagueOfAutomatedNations"
    const LOANsegment = 99

    if ((typeof RawMemory.foreignSegment == "undefined") || (RawMemory.foreignSegment.username !== LOANuser) || (RawMemory.foreignSegment.id !== LOANsegment)) {
      RawMemory.setActiveForeignSegment(LOANuser, LOANsegment)
      return "Execute this command in the next tick again to retrieve foreign memory segment"
    }
    if (RawMemory.foreignSegment.data == null) {
      return `Unexpectedly ${LOANuser} segment was null`
    }
    const LOANdata = JSON.parse(RawMemory.foreignSegment.data) as { [index: string]: string[] }
    for (const [alliance, usernames] of Object.entries(LOANdata)) {
      if (usernames.includes(playerName) === true) {
        return `${playerName} found in alliance ${alliance}`
      }
    }
    return `${playerName} is not joined any alliances`
  }

  private unclaim(): CommandExecutionResult {
    const args = this._parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const dryRun = (args.get("dry_run") === "0") !== true

    const room = Game.rooms[roomName]
    if (room == null || room.controller == null || room.controller.my !== true) {
      return `${roomLink(roomName)} is not owned`
    }

    return this.unclaimRoom(room, dryRun)
  }

  private unclaimRoom(room: Room, dryRun: boolean): CommandExecutionResult {
    const processes: Process[] = OperatingSystem.os.listAllProcesses().flatMap(processInfo => {
      const process = processInfo.process
      if (process instanceof RoomKeeperProcess) {
        if (process.roomName === room.name) {
          return process
        }
        return []
      }
      if (process instanceof V6RoomKeeperProcess) {
        if (process.roomName === room.name) {
          return process
        }
        return []
      }
      if (process instanceof Season1838855DistributorProcess) {
        if (process.parentRoomName === room.name) {
          return process
        }
        return []
      }
      if (process instanceof Season2055924SendResourcesProcess) {
        if (process.parentRoomName === room.name) {
          return process
        }
        return []
      }
      if (process instanceof Season1143119LabChargerProcess) {
        if (process.parentRoomName === room.name) {
          return process
        }
        return []
      }
      if (process instanceof DefenseRoomProcess) {
        if (process.roomName === room.name) {
          return process
        }
        return []
      }
      if (process instanceof DefenseRemoteRoomProcess) {
        if (process.roomName === room.name) {
          return process
        }
        return []
      }
      if (process instanceof World35587255ScoutRoomProcess) {
        if (process.parentRoomName === room.name) {
          return process
        }
        return []
      }
      return []
    })

    const constructionSiteCounts = new Map<StructureConstant, number>()
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES)
    constructionSites.forEach(constructionSite => {
      const structureType = constructionSite.structureType
      const count = constructionSiteCounts.get(structureType) ?? 0
      constructionSiteCounts.set(structureType, count + 1)
    })

    const flags = room.find(FIND_FLAGS)

    const messages: string[] = []

    const processDescriptions = processes.map(process => {
      const shortDescription = process.processShortDescription != null ? process.processShortDescription() : ""
      return `- ${tab(`${process.processId}`, Tab.medium)}: ${tab(`${process.constructor.name}`, Tab.veryLarge)} ${tab(shortDescription, Tab.medium)}`
    })
    messages.push(coloredText(`${processes.length} processes to remove:`, "info"))
    messages.push(...processDescriptions)

    if (constructionSiteCounts.size > 0) {
      const constructionSiteDescriptions = Array.from(constructionSiteCounts.entries()).map(([structureType, count]) => {
        return `- ${tab(structureType, Tab.medium)}: ${count}`
      })
      messages.push(coloredText("Construction sites to remove:", "info"))
      messages.push(...constructionSiteDescriptions)
    }
    if (flags.length > 0) {
      messages.push(coloredText(`${flags.length} flags`, "info"))
    }

    if (dryRun === true) {
      messages.unshift(`${coloredText("[Unclaim room]", "warn")} (dry run):`)
    } else {
      const result = room.controller?.unclaim()
      switch (result) {
      case OK:
        break
      default:
        messages.unshift(`${coloredText("[Unclaim room]", "error")}: FAILED ${result}:`)
        return messages.join("\n")
      }

      messages.unshift(`${coloredText("[Unclaim room]", "error")}:`)

      processes.forEach(process => {
        OperatingSystem.os.killProcess(process.processId)
      })
      constructionSites.forEach(constructionSite => {
        constructionSite.remove()
      })
      flags.forEach(flag => {
        flag.remove()
      })

      RoomResources.removeRoomInfo(room.name)
    }

    return messages.join("\n")
  }

  /** @throws */
  private powerCreep(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const powerCreep = listArguments.powerCreep(0, "power creep name").parse()
    return execPowerCreepCommand(powerCreep, args)
  }

  private runScript(): CommandExecutionResult {
    const args = [...this.args]
    args.splice(0, 1)

    const scriptName = args.shift()
    try {
      if (scriptName == null) {
        throw "Missing script name"
      }
      return temporaryScript(scriptName, args)
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }
}
