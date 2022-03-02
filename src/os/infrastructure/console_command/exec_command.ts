import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { calculateInterRoomShortestRoutes, placeRoadConstructionMarks, getRoadPositionsToParentRoom, calculateRoadPositionsFor } from "script/pathfinder"
import { describeLabs, showRoomPlan } from "script/room_plan"
import { ResourceManager } from "utility/resource_manager"
import { PrimitiveLogger } from "../primitive_logger"
import { coloredResourceType, coloredText, roomLink, Tab, tab } from "utility/log"
import { isResourceConstant } from "utility/resource"
import { isRoomName, RoomName } from "utility/room_name"
import { RoomResources } from "room_resource/room_resources"
import { Process } from "process/process"
import { OperatingSystem } from "os/os"
import { V6RoomKeeperProcess } from "process/process/v6_room_keeper_process"
import { DistributorProcess } from "process/process/distributor_process"
import { Season2055924SendResourcesProcess } from "process/temporary/season_2055924_send_resources_process"
import { BoostLabChargerProcess } from "process/process/boost_lab_charger_process"
import { RoomKeeperProcess } from "process/process/room_keeper_process"
import { calculateWallPositions } from "script/wall_builder"
import { temporaryScript } from "../../../../submodules/private/attack/script/temporary_script"
import { KeywordArguments } from "./utility/keyword_argument_parser"
import { DefenseRoomProcess } from "process/process/defense/defense_room_process"
import { DefenseRemoteRoomProcess } from "process/process/defense_remote_room_process"
import { World35587255ScoutRoomProcess } from "process/temporary/world_35587255_scout_room_process"
import { execPowerCreepCommand } from "./exec_commands/power_creep_command"
import { ListArguments } from "./utility/list_argument_parser"
import { execRoomConfigCommand } from "./exec_commands/room_config_command"
import { execRoomPathfindingCommand } from "./exec_commands/room_path_finding_command"
import { execCreepCommand } from "./exec_commands/creep_command"

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
      case "resource":
        return this.resource()
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
      case "prepare_unclaim":
        return this.prepareUnclaim(args)
      case "creep":
        return this.creep(args)
      case "power_creep":
        return this.powerCreep(args)
      case "room_path_finding":
        return this.roomPathFinding(args)
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

    const result = placeRoadConstructionMarks(startObject.pos, goalObject.pos, "manual", { dryRun, disableRouteWaypoint: true })
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
      return result.reason.errorMessage
    }
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
    args.shift()
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
      if (process instanceof DistributorProcess) {
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
      if (process instanceof BoostLabChargerProcess) {
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
  private prepareUnclaim(args: string[]): CommandExecutionResult {
    const keywordArguments = new KeywordArguments(args)
    const roomName = keywordArguments.roomName("room_name").parse({my: true})
    const targetSectorNames = keywordArguments.list("transfer_target_sector_names", "room_name").parse()
    const excludedResourceTypes = keywordArguments.list("excluded_resource_types", "resource").parseOptional() ?? []

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season2055924SendResourcesProcess.create(processId, roomName, targetSectorNames, excludedResourceTypes)
    })

    return `send resource process ${process.processId} launched`
  }

  /** @throws */
  private creep(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const creep = listArguments.creep(0, "creep name").parse()
    args.shift()
    return execCreepCommand(creep, args)
  }

  /** @throws */
  private powerCreep(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const powerCreep = listArguments.powerCreep(0, "power creep name").parse()
    args.shift()
    return execPowerCreepCommand(powerCreep, args)
  }

  /** @throws */
  private roomPathFinding(args: string[]): CommandExecutionResult {
    return execRoomPathfindingCommand(args)
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
