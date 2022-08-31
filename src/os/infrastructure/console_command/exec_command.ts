import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { calculateInterRoomShortestRoutes, placeRoadConstructionMarks, getRoadPositionsToParentRoom, calculateRoadPositionsFor } from "script/pathfinder"
import { describeLabs, showRoomPlan } from "script/room_plan"
import { ResourceManager } from "utility/resource_manager"
import { PrimitiveLogger } from "../primitive_logger"
import { coloredResourceType, coloredText, profileLink, roomLink, Tab, tab } from "utility/log"
import { isResourceConstant } from "shared/utility/resource"
import { isRoomName } from "shared/utility/room_name"
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
import { KeywordArguments } from "../../../shared/utility/argument_parser/keyword_argument_parser"
import { DefenseRoomProcess } from "process/process/defense/defense_room_process"
import { DefenseRemoteRoomProcess } from "process/process/defense_remote_room_process"
import { World35587255ScoutRoomProcess } from "process/temporary/world_35587255_scout_room_process"
import { execPowerCreepCommand } from "./exec_commands/power_creep_command"
import { ListArguments } from "../../../shared/utility/argument_parser/list_argument_parser"
import { execRoomConfigCommand } from "./exec_commands/room_config_command"
import { execRoomPathfindingCommand } from "./exec_commands/room_path_finding_command"
import { execCreepCommand } from "./exec_commands/creep_command"
import { CronProcess } from "process/onetime/cron_process"
import { AttackPlanner } from "process/onetime/attack/attack_planner"
import { PowerProcessProcess } from "process/process/power_creep/power_process_process"
import { PowerCreepProcess } from "process/process/power_creep/power_creep_process"
import { OnHeapDelayProcess } from "process/onetime/on_heap_delay_process"
import { RoomInterpreter } from "process/onetime/attack/room_interpreter"
import { } from "../../../../submodules/private/attack/planning/attack_plan"
import { } from "../../../../submodules/private/attack/platoon/platoon"
import { SwcAllyRequest } from "script/swc_ally_request"
import { HighwayProcessLauncherProcess } from "process/process/highway_process_launcher_process"
import { StealResourceProcess } from "process/onetime/steal_resource_process"
import { GuardRemoteRoomProcess } from "process/process/guard_remote_room_process"
import { QuadMakerProcess } from "process/onetime/quad_maker/quad_maker_process"
import { LaunchQuadProcess } from "process/onetime/quad_maker/launch_quad_process"
import { HarvestPowerProcess } from "process/onetime/harvest_power_process"
import { HarvestCommodityProcess } from "process/onetime/harvest_commodity_process"
import type { RoomName } from "shared/utility/room_name_types"

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
      case "attack_plan":
        return this.attackPlan(args)
      case "interpret_room":
        return this.interpretRoom(args)
      case "cron":
        return this.cron(args)
      case "enable_swc_ally_request":
        return this.enableSwcAllyRequest()
      case "show_swc_ally_requests":
        return this.showSwcAllyRequests()
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
        if (Memory.napAlliances.includes(alliance) === true) {
          return `${playerName} found in alliance ${alliance} (Non-Aggression Pacts)`
        }
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

    return this.unclaimRoom(roomName, dryRun)
  }

  private unclaimRoom(roomName: RoomName, dryRun: boolean): CommandExecutionResult {
    const processesToKill: Process[] = []

    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      const process = processInfo.process
      if (process instanceof RoomKeeperProcess) {
        if (process.roomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof V6RoomKeeperProcess) {
        if (process.roomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof DistributorProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof Season2055924SendResourcesProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof BoostLabChargerProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof DefenseRoomProcess) {
        if (process.roomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof DefenseRemoteRoomProcess) {
        if (process.roomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof World35587255ScoutRoomProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof PowerProcessProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof PowerCreepProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof StealResourceProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof GuardRemoteRoomProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof QuadMakerProcess) {
        if (process.roomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof LaunchQuadProcess) {
        if (process.roomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof HarvestPowerProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
      if (process instanceof HarvestCommodityProcess) {
        if (process.parentRoomName === roomName) {
          processesToKill.push(process)
        }
        return
      }
    })

    const messages: string[] = []

    const processDescriptions = processesToKill.map(process => {
      const shortDescription = process.processShortDescription != null ? process.processShortDescription() : ""
      return `- ${tab(`${process.processId}`, Tab.medium)}: ${tab(`${process.constructor.name}`, Tab.veryLarge)} ${tab(shortDescription, Tab.medium)}`
    })
    messages.push(coloredText(`${processesToKill.length} processes to remove:`, "info"))
    messages.push(...processDescriptions)

    const room = Game.rooms[roomName]
    const flags: Flag[] = []
    const constructionSiteCounts = new Map<StructureConstant, number>()
    const constructionSites: ConstructionSite<BuildableStructureConstant>[] = []
    const ownedStructures: AnyOwnedStructure[] = []

    if (room != null) {
      constructionSites.push(...room.find(FIND_CONSTRUCTION_SITES))
      ownedStructures.push(...room.find(FIND_MY_STRUCTURES))
      flags.push(...room.find(FIND_FLAGS))
    } else {
      flags.push(...Array.from(Object.values(Game.flags)).filter(flag => flag.pos.roomName === roomName))
    }

    constructionSites.forEach(constructionSite => {
      const structureType = constructionSite.structureType
      const count = constructionSiteCounts.get(structureType) ?? 0
      constructionSiteCounts.set(structureType, count + 1)
    })

    if (constructionSiteCounts.size > 0) {
      const constructionSiteDescriptions = Array.from(constructionSiteCounts.entries()).map(([structureType, count]) => {
        return `- ${tab(structureType, Tab.medium)}: ${count}`
      })
      messages.push(coloredText("Construction sites to remove:", "info"))
      messages.push(...constructionSiteDescriptions)
    }

    if (ownedStructures.length > 0) {
      messages.push(coloredText(`${ownedStructures.length} owned structures`, "info"))
    }

    if (flags.length > 0) {
      messages.push(coloredText(`${flags.length} flags`, "info"))
    }

    if (dryRun === true) {
      messages.unshift(`${coloredText("[Unclaim room]", "warn")} (dry run):`)
    } else {
      if (room != null && room.controller != null && room.controller.my === true) {
        const result = room.controller.unclaim()
        switch (result) {
        case OK:
          break
        default:
          messages.unshift(`${coloredText("[Unclaim room]", "error")}: FAILED ${result}:`)
          return messages.join("\n")
        }
      }

      messages.unshift(`${coloredText("[Unclaim room]", "error")}:`)

      processesToKill.forEach(process => {
        OperatingSystem.os.killProcess(process.processId)
      })
      constructionSites.forEach(constructionSite => {
        constructionSite.remove()
      })
      flags.forEach(flag => {
        flag.remove()
      })
      ownedStructures.forEach(structure => {
        structure.notifyWhenAttacked(false)
      })

      RoomResources.removeRoomInfo(roomName)
    }

    return messages.join("\n")
  }

  /** @throws */
  private prepareUnclaim(args: string[]): CommandExecutionResult {
    const results: string[] = []

    const keywordArguments = new KeywordArguments(args)
    const roomResource = keywordArguments.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name

    // Send Resource
    if (roomResource.activeStructures.terminal != null) {
      const targetSectorNames = keywordArguments.list("transfer_target_sector_names", "room_name").parse()
      const excludedResourceTypes = ((): ResourceConstant[] => {
        const given = keywordArguments.list("excluded_resource_types", "resource").parseOptional()
        if (given != null) {
          return given
        }
        return [
          RESOURCE_KEANIUM,
          RESOURCE_LEMERGIUM,
          RESOURCE_UTRIUM,
          RESOURCE_ZYNTHIUM,
        ]
      })()

      const process = OperatingSystem.os.addProcess(null, processId => {
        return Season2055924SendResourcesProcess.create(processId, roomName, targetSectorNames, excludedResourceTypes)
      })
      results.push(`send resource process ${process.processId} launched`)
    }

    // Stop Mineral Harvesting
    roomResource.roomInfoAccessor.config.mineralMaxAmount = 0
    results.push("stopped mineral harvesting")

    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      const process = processInfo.process
      if (process instanceof HighwayProcessLauncherProcess) {
        const baseRemovalResult = process.removeBase(roomName)
        switch (baseRemovalResult) {
        case "removed":
          results.push(`base removed from ${process.constructor.name}`)
          break
        case "no base":
          break
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _: never = baseRemovalResult
          break
        }
        }
        return
      }
      if (process instanceof PowerCreepProcess) {
        if (process.parentRoomName === roomName) {
          process.suicidePowerCreep()
          results.push(`commanded suicide PowerCreep ${process.powerCreepName}`)
        }
        return
      }
    })

    return [
      `preparing unclaim ${roomLink(roomName)}`,
      ...results.map(r => `- ${r}`),
    ].join("\n")
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

  /** @throws */
  private attackPlan(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const targetRoomName = listArguments.roomName(0, "target room name").parse()
    const targetRoom = Game.rooms[targetRoomName]

    if (targetRoom == null) {
      const observer = listArguments.visibleGameObject(1, "observer id").parse()
      if (!(observer instanceof StructureObserver)) {
        throw `${observer} is not StructureObserver`
      }
      const observeResult = observer.observeRoom(targetRoomName)
      if (observeResult !== OK) {
        throw `observing ${roomLink(targetRoomName)} from ${roomLink(observer.room.name)} failed with ${observeResult}`
      }

      OperatingSystem.os.addProcess(null, processId => {
        return OnHeapDelayProcess.create(
          processId,
          `observe ${roomLink(targetRoomName)} for planning attack`,
          1,
          (): string => {
            const observedTargetRoom = Game.rooms[targetRoomName]
            if (observedTargetRoom == null) {
              throw `observing ${roomLink(targetRoomName)} failed`
            }
            return this.attackPlanFor(observedTargetRoom)
          }
        )
      })
      return `reserved attack planning for ${roomLink(targetRoomName)}`
    }

    return this.attackPlanFor(targetRoom)
  }

  /** @throws */
  private attackPlanFor(targetRoom: Room): string {
    const attackPlanner = new AttackPlanner.Planner(targetRoom)
    const targetRoomPlan = attackPlanner.targetRoomPlan
    return AttackPlanner.describeTargetRoomPlan(targetRoomPlan)
  }

  /** @throws */
  private interpretRoom(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const targetRoomName = listArguments.roomName(0, "target room name").parse()
    const targetRoom = Game.rooms[targetRoomName]

    if (targetRoom == null) {
      const observer = listArguments.visibleGameObject(1, "observer id").parse()
      if (!(observer instanceof StructureObserver)) {
        throw `${observer} is not StructureObserver`
      }
      const observeResult = observer.observeRoom(targetRoomName)
      if (observeResult !== OK) {
        throw `observing ${roomLink(targetRoomName)} from ${roomLink(observer.room.name)} failed with ${observeResult}`
      }

      OperatingSystem.os.addProcess(null, processId => {
        return OnHeapDelayProcess.create(
          processId,
          `observe ${roomLink(targetRoomName)} for interpreting room plan`,
          1,
          (): string => {
            const observedTargetRoom = Game.rooms[targetRoomName]
            if (observedTargetRoom == null) {
              throw `observing ${roomLink(targetRoomName)} failed`
            }
            return this.interpretRoomFor(observedTargetRoom)
          }
        )
      })
      return `reserved interpreting for ${roomLink(targetRoomName)}`
    }

    return this.interpretRoomFor(targetRoom)
  }

  private interpretRoomFor(targetRoom: Room): string {
    RoomInterpreter.interpret(targetRoom)
    return "ok"
  }

  // Game.io("exec cron 1000 command=exec script collect_power dry_run=0")  // 実装上execを指定しているが、他のosコマンドは実行されない
  /** @throws */
  private cron(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const interval = listArguments.int(0, "interval").parse({ min: 1 })
    const command = this.rawCommand.split("command=")[1]  // LaunchCommandでこれを行うのがだるいため
    if (command == null || command.length <= 0) {
      throw "missing command argument"
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return CronProcess.create(processId, interval, command)
    })
    Memory.os.logger.filteringProcessIds.push(process.processId)
    return "ok"
  }

  private enableSwcAllyRequest(): CommandExecutionResult {
    Memory.os.enabledDrivers.swcAllyRequest = true

    return "ok"
  }

  private showSwcAllyRequests(): CommandExecutionResult {
    const requests = SwcAllyRequest.getRequests()
    requests.sort((lhs, rhs) => rhs.request.priority - lhs.request.priority)

    const invalidRequests: string[] = Array.from(SwcAllyRequest.getInvalidRequests().entries()).flatMap(([allyName, value]) => {
      if (value.length <= 0) {
        return []
      }
      return [
        `- ${profileLink(allyName)}:`,
        ...value.map(invalidRequest => `  - ${invalidRequest.reason}, ${JSON.stringify(invalidRequest.request)}`),
      ]
    })

    const results: string[] = []

    if (requests.length > 0) {
      results.push("requests:")
      results.push(...requests.map(request => `- ${profileLink(request.allyName)}: ${SwcAllyRequest.describeRequest(request.request)}`))
    }
    if (invalidRequests.length > 0) {
      results.push("invalid requests:")
      results.push(...invalidRequests)
    }
    if (results.length <= 0) {
      return "no requests"
    }

    return results.join("\n")
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
