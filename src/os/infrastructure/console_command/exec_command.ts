import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { calculateInterRoomShortestRoutes, findPath, findPathToSource, placeRoadConstructionMarks } from "script/pathfinder"
import { describeLabs, placeOldRoomPlan, showOldRoomPlan, showRoomPlan } from "script/room_plan"
import { showPositionsInRange } from "script/room_position_script"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask as MoveToTargetTaskV5 } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { TransferResourceApiWrapper, TransferResourceApiWrapperTargetType } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { isV5CreepMemory, isV6CreepMemory } from "prototype/creep"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { ResourceManager } from "utility/resource_manager"
import { PrimitiveLogger } from "../primitive_logger"
import { coloredResourceType, coloredText, roomLink, Tab, tab } from "utility/log"
import { isMineralCompoundConstant, isResourceConstant } from "utility/resource"
import { isRoomName, RoomName } from "utility/room_name"
import { RoomResources } from "room_resource/room_resources"
import { MoveToTargetTask } from "object_task/creep_task/task/move_to_target_task"
import { TransferApiWrapper } from "object_task/creep_task/api_wrapper/transfer_api_wrapper"
import { WithdrawApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_api_wrapper"
import { OwnedRoomInfo } from "room_resource/room_info"
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
import { QuadRequirement } from "../../../../submodules/attack/quad/quad_requirement"
import { QuadSpec } from "../../../../submodules/attack/quad/quad_spec"
import { temporaryScript } from "../../../../submodules/attack/script/temporary_script"
import { KeywordArguments } from "./utility/keyword_argument_parser"
import { remoteRoomNamesToDefend } from "process/temporary/season_487837_attack_invader_core_room_names"

export class ExecCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    try {
      switch (this.args[0]) {
      case "findPath":
        return this.findPath()
      case "findPathToSource":
        return this.findPathToSource()
      case "showOldRoomPlan":
        return this.showOldRoomPlan()
      case "placeOldRoomPlan":
        return this.placeOldRoomPlan()
      case "show_remote_route":
        return this.showRemoteRoute()
      case "calculate_inter_room_shortest_routes":
        return this.calculateInterRoomShortestRoutes()
      case "showPositionsInRange":
        return this.showPositionsInRange()
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
        // case "check_existing_walls":
        //   return this.checkExistingWalls()
      case "mineral":
        return this.showHarvestableMinerals()
      case "room_config":
        return this.configureRoomInfo()
      case "check_alliance":
        return this.checkAlliance()
      case "unclaim":
        return this.unclaim()
      case "create_quad":
        return this.createQuad()
      case "show_remote_rooms_to_defend":
        return this.showRemoteRoomsToDefend()
      case "script":
        return this.runScript()
      default:
        throw "Invalid script type"
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

    const dryRun = true

    const result = placeRoadConstructionMarks(startObject.pos, goalObject.pos, "manual", { dryRun })
    switch (result.resultType) {
    case "succeeded":
      return result.value
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

  // private checkExistingWalls(): CommandExecutionResult {
  //   const roomHasWalls: RoomName[] = []
  //   const roomWithoutWalls: RoomName[] = []

  //   RoomResources.getOwnedRoomResources().forEach(roomResource => {
  //     const roomPlan = roomResource.roomInfo.roomPlan
  //     if (roomPlan == null) {
  //       return
  //     }
  //     const room = roomResource.room
  //     const wallCount = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } }).length + room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } }).length
  //     if (wallCount > 20) {
  //       roomPlan.wallPositions = []
  //       roomHasWalls.push(roomResource.room.name)
  //     } else {
  //       roomWithoutWalls.push(roomResource.room.name)
  //     }
  //   })

  //   return `rooms have walls:\n${roomHasWalls.map(roomName => roomLink(roomName)).join(",")}\nrooms don't have walls:\n${roomWithoutWalls.map(roomName => roomLink(roomName)).join(",")}`
  // }

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

  // Game.io("exec room_config room_name= setting=")
  private configureRoomInfo(): CommandExecutionResult {
    const args = this._parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const roomInfo = Memory.v6RoomInfo[roomName]
    if (roomInfo == null) {
      return `No roomInfo object in memory ${roomLink(roomName)}`
    }
    if (roomInfo.roomType !== "owned") {
      return `Room ${roomLink(roomName)} is not mine`
    }

    const settingList = ["excluded_remotes", "wall_positions", "research_compounds", "refresh_research_labs", "disable_boost_labs", "toggle_auto_attack"]
    const setting = args.get("setting")

    try {
      switch (setting) {
      case "excluded_remotes":
        return this.addExcludedRemoteRoom(roomName, roomInfo, args)
      case "wall_positions":
        return this.configureWallPositions(roomName, roomInfo, args)
      case "research_compounds":
        return this.configureResearchCompounds(roomName, roomInfo, args)
      case "refresh_research_labs":
        return this.refreshResearchLabs(roomName, roomInfo, args)
      case "disable_boost_labs":
        return this.disableBoostLabs(roomName, roomInfo)
      case "toggle_auto_attack":
        return this.toggleAutoAttack(roomName, roomInfo, args)
      default:
        throw `Invalid setting ${setting}, available settings are: ${settingList}`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  private toggleAutoAttack(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): CommandExecutionResult {
    const rawEnabled = args.get("enabled")
    if (rawEnabled == null) {
      return this.missingArgumentError("enabled")
    }
    if (rawEnabled !== "0" && rawEnabled !== "1") {
      return `Invalid enable argument ${rawEnabled}: set 0 or 1`
    }
    const enabled = rawEnabled === "1"

    if (roomInfo.config == null) {
      roomInfo.config = {}
    }
    const oldValue = roomInfo.config.enableAutoAttack
    roomInfo.config.enableAutoAttack = enabled

    return `${roomLink(roomName)} auto attack set ${oldValue} => ${enabled}`
  }

  private disableBoostLabs(roomName: RoomName, roomInfo: OwnedRoomInfo): CommandExecutionResult {
    const room = Game.rooms[roomName]
    if (room == null) {
      return `${roomLink(roomName)} no found`
    }
    if (roomInfo.researchLab == null) {
      return `roomInfo.researchLab is null ${roomLink(roomName)}`
    }

    if (roomInfo.config?.boostLabs == null) {
      return `no boost labs in ${roomLink(roomName)}`
    }

    const oldValue = [...roomInfo.config.boostLabs]
    roomInfo.researchLab.outputLabs.push(...oldValue)
    roomInfo.config.boostLabs = []

    return `added ${oldValue.length} boost labs to research output labs (${roomInfo.researchLab.outputLabs.length} output labs)`
  }

  /** throws */
  private refreshResearchLabs(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): CommandExecutionResult {
    const room = Game.rooms[roomName]
    if (room == null) {
      return `${roomLink(roomName)} no found`
    }
    if (roomInfo.researchLab == null) {
      roomInfo.researchLab = this.setResearchLabs(room, roomInfo, args)
    }

    const labIdsInRoom = (room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[])
      .map(lab => lab.id)

    const researchLabIds: Id<StructureLab>[] = [
      roomInfo.researchLab.inputLab1,
      roomInfo.researchLab.inputLab2,
      ...roomInfo.researchLab.outputLabs,
    ]
    researchLabIds.forEach(researchLabId => {
      const index = labIdsInRoom.indexOf(researchLabId)
      if (index >= 0) {
        labIdsInRoom.splice(index, 1)
      }
    })

    const boostLabIds = roomInfo.config?.boostLabs
    if (boostLabIds != null) {
      boostLabIds.forEach(boostLabId => {
        const index = labIdsInRoom.indexOf(boostLabId)
        if (index >= 0) {
          labIdsInRoom.splice(index, 1)
        }
      })
    }

    if (labIdsInRoom.length <= 0) {
      return `no unused lab in ${roomLink(roomName)}, ${boostLabIds?.length ?? 0} boost labs and ${researchLabIds.length} research labs`
    }
    roomInfo.researchLab.outputLabs.push(...labIdsInRoom)

    return `${labIdsInRoom.length} labs added to research output labs`
  }

  //** throws */
  private setResearchLabs(room: Room, roomInfo: OwnedRoomInfo, args: Map<string, string>): {inputLab1: Id<StructureLab>, inputLab2: Id<StructureLab>, outputLabs: Id<StructureLab>[]} {
    const keywardArguments = new KeywordArguments(args)
    const missingArgumentErrorMessage = `no roomInfo.researchLab for ${roomLink(room.name)} set input_lab_id_1 and input_lab_id_2`
    const inputLab1Id = keywardArguments.gameObjectId("input_lab_id_1", {missingArgumentErrorMessage}).parse() as Id<StructureLab>
    const inputLab2Id = keywardArguments.gameObjectId("input_lab_id_2", { missingArgumentErrorMessage }).parse() as Id<StructureLab>
    if (inputLab1Id === inputLab2Id) {
      throw `input_lab_id_1 and input_lab_id_2 has the same value ${inputLab1Id}`
    }

    const validateLabId = (labId: Id<StructureLab>, key: string): void => {
      const lab = Game.getObjectById(labId)
      if (!(lab instanceof StructureLab)) {
        throw `ID for ${key} is not a lab (${lab})`
      }
    }

    validateLabId(inputLab1Id, "input_lab_id_1")
    validateLabId(inputLab2Id, "input_lab_id_2")

    return {
      inputLab1: inputLab1Id,
      inputLab2: inputLab2Id,
      outputLabs: [],
    }
  }

  private configureResearchCompounds(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): CommandExecutionResult {
    const getCompoundSetting = (): [MineralCompoundConstant, number] | string => {
      const compoundType = args.get("compound")
      if (compoundType == null) {
        return this.missingArgumentError("compound")
      }
      if (!isMineralCompoundConstant(compoundType)) {
        return `${compoundType} is not valid mineral compound type`
      }
      const rawAmount = args.get("amount")
      if (rawAmount == null) {
        return this.missingArgumentError("amount")
      }
      const amount = parseInt(rawAmount, 10)
      if (isNaN(amount) === true) {
        return `amount is not a number ${rawAmount}`
      }
      return [
        compoundType,
        amount
      ]
    }

    const action = args.get("action")
    if (action == null) {
      return this.missingArgumentError("action")
    }

    const getResearchCompounds = (): { [index in MineralCompoundConstant]?: number } => {
      if (roomInfo.config == null) {
        roomInfo.config = {}
      }
      if (roomInfo.config.researchCompounds == null) {
        roomInfo.config.researchCompounds = {}
      }
      return roomInfo.config.researchCompounds
    }

    const getCurentsettings = (): string => {
      const entries = Object.entries(getResearchCompounds())
      if (entries.length <= 0) {
        return "no research compounds"
      }
      return entries
        .map(([compoundType, amount]) => `\n- ${coloredResourceType(compoundType as MineralCompoundConstant)}: ${amount}`)
        .join("")
    }

    switch (action) {
    case "show":
      return getCurentsettings()
    case "clear": {
      const currentSettings = getCurentsettings()
      if (roomInfo.config == null) {
        roomInfo.config = {}
      }
      roomInfo.config.researchCompounds = {}
      return `${coloredText("cleared", "info")}: ${currentSettings}`
    }
    case "add": {
      const settings = getCompoundSetting()
      if (typeof settings === "string") {
        return settings
      }
      const researchCompounds = getResearchCompounds()
      researchCompounds[settings[0]] = settings[1]
      return `${coloredText("added", "info")} ${coloredResourceType(settings[0])}: ${getCurentsettings()}`
    }
    default:
      return `Invalid action ${action}`
    }
  }

  private addExcludedRemoteRoom(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): CommandExecutionResult {
    const remoteRoomName = args.get("remote_room_name")
    if (remoteRoomName == null) {
      return this.missingArgumentError("remote_room_name")
    }
    if (!isRoomName(remoteRoomName)) {
      return `Invalid remote_room_name ${remoteRoomName}`
    }
    if (roomInfo.config == null) {
      roomInfo.config = {}
    }
    if (roomInfo.config.excludedRemotes == null) {
      roomInfo.config.excludedRemotes = []
    }
    if (roomInfo.config.excludedRemotes.includes(remoteRoomName) === true) {
      return `${roomLink(remoteRoomName)} is already excluded`
    }
    roomInfo.config.excludedRemotes.push(remoteRoomName)
    return `${roomLink(remoteRoomName)} is added to excluded list in ${roomLink(roomName)}`
  }

  private configureWallPositions(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): CommandExecutionResult {
    const roomPlan = roomInfo.roomPlan
    if (roomPlan == null) {
      return `${roomLink(roomName)} doesn't have room plan`
    }

    const action = args.get("action")
    if (action == null) {
      return this.missingArgumentError("action")
    }
    switch (action) {
    case "remove":
      roomPlan.wallPositions = undefined
      return "wall positions removed"
    case "set_it_done":
      roomPlan.wallPositions = []
      return "ok"
    default:
      return `Invalid action ${action}`
    }
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
    messages.push(coloredText("Processes to remove:", "info"))
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

  private createQuad(): CommandExecutionResult {
    const args = this.args.concat([])
    args.splice(0, 1)
    const rawRequirement = args.join(" ")

    const requirementResult = QuadRequirement.parse(rawRequirement)
    switch (requirementResult.resultType) {
    case "failed":
      return `${requirementResult.reason}\n(raw argument: ${rawRequirement}`
    case "succeeded":
      break
    }

    const specResult = QuadSpec.create(requirementResult.value)
    switch (specResult.resultType) {
    case "failed":
      return `${specResult.reason}`
    case "succeeded":
      break
    }
    const quadSpec = specResult.value

    return quadSpec.description()
  }

  private showRemoteRoomsToDefend(): CommandExecutionResult {
    const lines = Array.from(remoteRoomNamesToDefend.entries()).map(([parentRoomName, remoteRoomNames]) => {
      return `${roomLink(parentRoomName)}: ${remoteRoomNames.map(roomName => roomLink(roomName)).join(", ")}`
    })
    return lines.join("\n")
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
