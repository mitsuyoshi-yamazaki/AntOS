import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { calculateInterRoomShortestRoutes, placeRoadConstructionMarks, getRoadPositionsToParentRoom, calculateRoadPositionsFor } from "script/pathfinder"
import { describeLabs, showRoomPlan } from "script/room_plan"
import { ResourceManager } from "utility/resource_manager"
import { coloredResourceType, coloredText, profileLink, roomLink } from "utility/log"
import { RoomResources } from "room_resource/room_resources"
import { OperatingSystem } from "os/os"
import { calculateWallPositions } from "script/wall_builder"
import { temporaryScript } from "../../../../submodules/private/attack/script/temporary_script"
import { KeywordArguments } from "../../../shared/utility/argument_parser/keyword_argument_parser"
import { execPowerCreepCommand } from "./exec_commands/power_creep_command"
import { ListArguments } from "../../../shared/utility/argument_parser/list_argument_parser"
import { execRoomConfigCommand } from "./exec_commands/room_config_command"
import { execRoomPathfindingCommand } from "./exec_commands/room_path_finding_command"
import { execCreepCommand } from "./exec_commands/creep_command"
import { AttackPlanner } from "process/onetime/attack/attack_planner"
import { OnHeapDelayProcess } from "process/onetime/on_heap_delay_process"
import { RoomInterpreter } from "process/onetime/attack/room_interpreter"
import { } from "../../../../submodules/private/attack/planning/attack_plan"
import { } from "../../../../submodules/private/attack/platoon/platoon"
import { SwcAllyRequest } from "script/swc_ally_request"
import type { RoomName } from "shared/utility/room_name_types"
import { prepareUnclaim, unclaim } from "./exec_commands/unclaim_command"
import { execIntegratedAttackCommand } from "../../../../submodules/private/attack/integrated_attack/standard_io/integrated_attack_command"
import { execResourceCommand } from "./exec_commands/resource_command"
import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"
import { isRoomName } from "utility/room_coordinate"
import { SendEnergyToAllyProcess } from "process/onetime/send_energy_to_ally_process"
import { execMemorySerializationCommand } from "./exec_commands/memory_serialization_command"

export class ExecCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    try {
      const result = this.runCommand()
      Game.serialization.shouldSerializeMemory()
      return result
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private runCommand(): CommandExecutionResult {
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
      return execResourceCommand(args)
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
      return this.unclaim(args)
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
    case "enable_swc_ally_request":
      return this.enableSwcAllyRequest()
    case "show_swc_ally_requests":
      return this.showSwcAllyRequests()
    case "script":
      return this.runScript()
    case "memory_serialization":
      return execMemorySerializationCommand(args)
    case "find_researchable_rooms":
      return this.findResearchableRooms()
    case "integrated_attack":
      return this.integratedAttack(args)
    default:
      throw `Invalid script type ${scriptType}`
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

  /** @throws */
  private unclaim(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const roomName = listArguments.roomName(0, "room name").parse()
    args.shift()

    return unclaim(roomName, args)
  }

  private prepareUnclaim(args: string[]): CommandExecutionResult {
    const listArguments = new ListArguments(args)
    const roomName = listArguments.roomName(0, "room name").parse()
    args.shift()

    return prepareUnclaim(roomName, args)
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

  private findResearchableRooms(): CommandExecutionResult {
    const roomNames = RoomResources.getOwnedRoomResources().flatMap((roomResource): RoomName[] => {
      const researchLabs = roomResource.roomInfoAccessor.researchLabs
      if (researchLabs == null) {
        return []
      }
      if (researchLabs.outputLabs.length < 6) {
        return []
      }
      return [roomResource.room.name]
    })

    return `found ${roomNames.length} rooms\n- ${roomNames.map(roomName => roomLink(roomName)).join(", ")}`
  }

  /** @throws */
  private integratedAttack(args: string[]): CommandExecutionResult {
    return execIntegratedAttackCommand(args)
  }

  /** @throws */
  private bot(args: string[]): CommandExecutionResult {
    const argumentParser = new ArgumentParser(args)
    const commands = ["help", "losing_room"] as const
    const command = argumentParser.list.stringInList(0, "command", commands).parse()

    switch (command) {
    case "help":
      return `available commands: ${commands.join(", ")}`

    case "losing_room": {
      const subCommands = ["add", "remove"] as const
      const subCommand = argumentParser.list.stringInList(1, "sub command", subCommands).parse()
      const roomName = argumentParser.list.roomName(2, "room name").parse({my: true})
      switch (subCommand) {
      case "add":
        if (Memory.gameInfo.losingRoomNames?.includes(roomName) === true) {
          throw `${roomLink(roomName)} is already in the list`
        }
        if (Memory.gameInfo.losingRoomNames == null) {
          Memory.gameInfo.losingRoomNames = []
        }
        Memory.gameInfo.losingRoomNames.push(roomName)
        return `${roomLink(roomName)} added`

      case "remove": {
        if (Memory.gameInfo.losingRoomNames == null) {
          throw `${roomLink(roomName)} is not in the list`
        }
        const index = Memory.gameInfo.losingRoomNames.indexOf(roomName)
        if (index < 0) {
          throw `${roomLink(roomName)} is not in the list`
        }
        Memory.gameInfo.losingRoomNames.splice(index, 1)
        return `${roomLink(roomName)} removed`
      }
      }
    }
    }
  }
}
