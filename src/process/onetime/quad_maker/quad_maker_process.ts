import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { isValidRoomName } from "shared/utility/room_name"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { QuadCreepSpec, QuadSpec } from "../../../../submodules/private/attack/quad/quad_spec"
import { isMineralBoostConstant } from "shared/utility/resource"
import { CreepBody, isBodyPartConstant } from "utility/creep_body"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { KeywordArguments } from "shared/utility/argument_parser/keyword_argument_parser"
import { QuadMaker, QuadMakerState } from "./quad_maker"
import type { RoomName } from "shared/utility/room_name_types"
import { OwnedRoomProcess } from "process/owned_room_process"
import { OperatingSystem } from "os/os"
import { GameMap } from "game/game_map"
import { isQuadAction, isQuadPlan } from "@private/attack/quad/quad_process"

ProcessDecoder.register("QuadMakerProcess", state => {
  return QuadMakerProcess.decode(state as QuadMakerProcessState)
})

const parameterNames = ["room_name", "target_room_name", "front_base_room_name", "name"]
const argumentNames = ["handle_melee", "damage_tolerance", "boosts", "creep", "target_ids", "codename", "waypoints", "quad_waypoints", "quad_action", "quad_plan"]

interface QuadMakerProcessState extends ProcessState {
  readonly quadMakerState: QuadMakerState
}

export class QuadMakerProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }
  public get roomName(): RoomName {
    return this.quadMaker.roomName
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly quadMaker: QuadMaker,
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}_${this.quadMaker.quadName}_${this.quadMaker.targetRoomName}`
  }

  public encode(): QuadMakerProcessState {
    return {
      t: "QuadMakerProcess",
      l: this.launchTime,
      i: this.processId,
      quadMakerState: this.quadMaker.encode(),
    }
  }

  public static decode(state: QuadMakerProcessState): QuadMakerProcess {
    return new QuadMakerProcess(
      state.l,
      state.i,
      QuadMaker.decode(state.quadMakerState),
    )
  }

  public static create(processId: ProcessId, quadName: string, roomName: RoomName, targetRoomName: RoomName): QuadMakerProcess {
    return new QuadMakerProcess(Game.time, processId, QuadMaker.create(quadName, roomName, targetRoomName))
  }

  public processShortDescription(): string {
    return this.quadMaker.shortDescription()
  }

  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    const command = components.shift()

    try {
      if (command == null) {
        throw "Missing command"
      }
      return this.executeCommand(command, components)
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    // does nothing
  }

  private executeCommand(command: string, args: string[]): string {
    const commands = ["help", "set", "reset", "show", "verify", "launch", "clone"]

    switch (command) {
    case "help":
      return `Quad maker
commands: ${commands}

- help
  - show help
- change &ltparameter_name&gt &ltvalue&gt
  - change process parameter values
  - parameter names: ${parameterNames}
- set &ltargument_name&gt &ltvalue&gt &ltkey&gt=&ltvalue&gt &ltkey&gt=&ltvalue&gt...
  - set quad arguments
  - arguments: ${argumentNames}
- reset &ltargument_name&gt
  - reset quad argument
  - arguments: ${argumentNames}
  - specify creep index to reset specific creep spec
- show
  - show current quad arguments
- verify
  - check energyCapacityAvailable to verify
- launch dry_run?= delay?=
  - launch quad process
- clone
  - clone this process
      `

    case "change":
      return this.change(args)

    case "set":
      return this.set(args)

    case "reset":
      return this.reset(args)

    case "show":
      return this.quadMaker.description()

    case "verify": {
      const result = this.quadMaker.verify()
      switch (result.resultType) {
      case "failed":
        return result.reason.join("\n")
      case "succeeded":
        if (result.value.warnings.length > 0) {
          return result.value.warnings.join("\n")
        }
        return "ok"
      }
    }

    // eslint-disable-next-line no-fallthrough
    case "launch": {
      return this.launchQuadProcess(args)
    }

    case "clone":
      return this.clone(args)

    default:
      throw `Invalid command ${command}. see "help"`
    }
  }

  /** @throws */
  private clone(args: string[]): string {
    const keywordArguments = new KeywordArguments(args)
    const name = keywordArguments.string("name").parse()
    const roomName = keywordArguments.roomName("room_name").parseOptional({ my: true }) ?? this.quadMaker.roomName
    const targetRoomName = keywordArguments.roomName("target_room_name").parseOptional() ?? this.quadMaker.targetRoomName

    const quadMaker = this.quadMaker.cloned(name)
    quadMaker.roomName = roomName
    quadMaker.targetRoomName = targetRoomName

    const process = OperatingSystem.os.addProcess(null, processId => (new QuadMakerProcess(
      Game.time,
      processId,
      quadMaker,
    )))

    return `launched ${process.processId}`
  }

  /** @throws */
  private change(args: string[]): string {
    const parameter = args.shift()

    switch (parameter) {
    case "room_name": {
      const roomName = args[0]
      if (roomName == null) {
        throw "Missing room name argument"
      }
      if (isValidRoomName(roomName) !== true) {
        throw `Invalid room name ${roomName}`
      }
      const oldValue = this.quadMaker.roomName
      this.quadMaker.roomName = roomName
      return `Changed room_name ${oldValue} =&gt ${this.quadMaker.roomName}`
    }

    case "target_room_name": {
      const targetRoomName = args[0]
      if (targetRoomName == null) {
        throw "Missing target room name argument"
      }
      if (isValidRoomName(targetRoomName) !== true) {
        throw `Invalid target room name ${targetRoomName}`
      }
      const oldValue = this.quadMaker.targetRoomName
      this.quadMaker.targetRoomName = targetRoomName

      const results: string[] = [
        `Changed target_room_name ${oldValue} =&gt ${this.quadMaker.targetRoomName}`,
      ]

      if (this.quadMaker.waypoints != null) {
        this.quadMaker.waypoints = null
        results.push("waypoints removed")
      }

      if (this.quadMaker.targetIds.length > 0) {
        this.quadMaker.targetIds = []
        results.push("target IDs remvoed")
      }

      return results.join(", ")
    }

    case "front_base_room_name": {
      if (this.quadMaker.waypoints != null) {
        throw "while front_base_room_name is set, waypoints are ignored"
      }

      const frontBaseRoomName = args[0]
      if (frontBaseRoomName == null) {
        throw "Missing front base room name argument"
      }
      const frontRoom = Game.rooms[frontBaseRoomName]
      if (frontRoom == null || frontRoom.controller?.my !== true) {
        throw `Front room ${roomLink(frontBaseRoomName)} is not mine`
      }
      const oldValue = this.quadMaker.frontBaseRoomName
      this.quadMaker.frontBaseRoomName = frontBaseRoomName
      return `Changed front_base_room_name ${oldValue} =&gt ${this.quadMaker.frontBaseRoomName}`
    }

    case "name": {
      const oldValue = this.quadMaker.quadName
      if (args[0] == null) {
        throw "No name argument"
      }
      this.quadMaker.quadName = args[0]

      return `Changed name ${oldValue} =&gt ${this.quadMaker.quadName}`
    }

    default:
      throw `Invalid parameter name ${parameter}. Available parameters are: ${parameterNames}`
    }
  }

  private set(args: string[]): string {
    const argument = args.shift()

    switch (argument) {
    case "handle_melee": {
      const handleMelee = args[0]
      if (handleMelee !== "0" && handleMelee !== "1") {
        throw `handle_melee value should be "0" or "1" (${handleMelee})`
      }
      this.quadMaker.canHandleMelee = handleMelee === "1"
      return `set handle_melee=${this.quadMaker.canHandleMelee}`
    }

    case "damage_tolerance": {
      const rawValue = args[0]
      if (rawValue == null) {
        throw "damage_tolerance no value (set 0.0~1.0)"
      }
      const value = parseFloat(rawValue)
      if (isNaN(value) === true) {
        throw "damage_tolerance value is not a number (set 0.0~1.0)"
      }
      if (value < 0 || value > 1) {
        throw `damage_tolerance invalid value ${value}. set 0.0~1.0`
      }
      this.quadMaker.damageTolerance = value
      return `set damage_tolerance=${this.quadMaker.damageTolerance}`
    }

    case "boosts": {
      const rawBoosts = args[0]
      if (rawBoosts == null) {
        throw "no boosts specified, use \"reset\" command to reset boosts"
      }
      const boosts = ((): MineralBoostConstant[] => {
        const result: MineralBoostConstant[] = []
        for (const value of rawBoosts.split(",")) {
          if (!isMineralBoostConstant(value)) {
            throw `Invalid boost ${value}`
          }
          result.push(value)
        }
        return result
      })()

      this.quadMaker.boosts = boosts
      return `set boosts=${this.quadMaker.boosts.map(boost => coloredResourceType(boost)).join(",")}`
    }

    case "creep": {
      const keyValueArgs = new Map<string, string>()
      args.forEach(arg => {
        const [key, value] = arg.split("=")
        if (key == null || value == null) {
          return
        }
        keyValueArgs.set(key, value)
      })

      const rawCount = keyValueArgs.get("count")
      if (rawCount == null) {
        throw "Missing count argument"
      }
      const creepCount = parseInt(rawCount)
      if (isNaN(creepCount) === true) {
        throw `count ${rawCount} is not a number`
      }

      const bodyDescription = keyValueArgs.get("body")
      if (bodyDescription == null) {
        throw "Missing body argument"
      }
      const body = ((): BodyPartConstant[] => {
        const bodyComponents = bodyDescription.split(",")
        const result: BodyPartConstant[] = []

        for (const component of bodyComponents) {
          const createErrorMessage = (error: string): string => {
            return `Invalid body format: ${error} in ${component}. body=&ltcount&gt&ltbody part&gt,&ltcount&gt&ltbody part&gt,... e.g. body=3TOUGH,3MOVE,10HEAL,10MOVE`
          }
          const parts = component.split(/(\d+)/)
          const rawBodyPartsCount = parts[1]
          if (rawBodyPartsCount == null) {
            throw createErrorMessage("missing body count")
          }
          const bodyPartsCount = parseInt(rawBodyPartsCount)
          if (isNaN(bodyPartsCount) === true) {
            throw createErrorMessage("body count is not a number")
          }
          const bodyPart = parts[2]?.toLowerCase()
          if (bodyPart == null) {
            throw createErrorMessage("missing body part definition")
          }
          if (!isBodyPartConstant(bodyPart)) {
            throw createErrorMessage(`invalid body part ${bodyPart}`)
          }
          result.push(...Array(bodyPartsCount).fill(bodyPart))
        }
        return result
      })()

      const creepSpec: QuadCreepSpec = {
        body
      }
      const newCreepSpecs = Array(creepCount).fill({ ...creepSpec })
      this.quadMaker.creepSpecs.push(...newCreepSpecs)
      return `set ${newCreepSpecs.length} ${CreepBody.description(body)}, ${bodyDescription}`
    }

    case "target_ids": {
      const listArguments = new ListArguments(args)
      const targetIds = listArguments.string(0, "target ids").parse().split(",")
      this.quadMaker.targetIds = targetIds as Id<AnyCreep | AnyStructure>[]
      return `set target IDs ${this.quadMaker.targetIds.join(", ")}`
    }

    case "codename": {
      const listArguments = new ListArguments(args)
      const codename = listArguments.string(0, "codename").parse()
      this.quadMaker.quadProcessCodename = codename

      return `set quad creep codename: "${codename}"`
    }

    case "waypoints": {
      const listArguments = new ListArguments(args)
      const waypoints = listArguments.list(0, "room_names", "room_name").parse()
      GameMap.setWaypoints(this.quadMaker.roomName, this.quadMaker.targetRoomName, waypoints)

      return `set ${roomLink(this.quadMaker.roomName)} =&gt ${waypoints.map(roomName => roomLink(roomName)).join(", ")} =&gt ${roomLink(this.quadMaker.targetRoomName)}`
    }

    case "quad_waypoints": {
      if (this.quadMaker.frontBaseRoomName != null) {
        throw "while front_base_room_name has a value, waypoints are ignored"
      }

      const listArguments = new ListArguments(args)
      const waypoints = listArguments.list(0, "room_names", "room_name").parse()
      this.quadMaker.waypoints = waypoints

      return `set ${waypoints.map(roomName => roomLink(roomName)).join(" =&gt ")}`
    }

    case "quad_action": {
      const listArguments = new ListArguments(args)
      const previousValue = this.quadMaker.action ?? null
      this.quadMaker.action = listArguments.typedString(0, "action", "QuadAction", isQuadAction).parse()

      return `Set action ${this.quadMaker.action} from ${previousValue}`
    }

    case "quad_plan": {
      const listArguments = new ListArguments(args)
      const previousValue = this.quadMaker.plan ?? null
      this.quadMaker.plan = listArguments.typedString(0, "plan", "QuadPlan", isQuadPlan).parse()

      return `Set plan ${this.quadMaker.plan} from ${previousValue}`
    }

    default:
      throw `Invalid argument name ${argument}. Available arguments are: ${argumentNames}`
    }
  }

  private reset(args: string[]): string {
    const argument = args.shift()

    switch (argument) {
    case "handle_melee":
      this.quadMaker.canHandleMelee = QuadSpec.canHandleMeleeDefaultValue
      return `reset handle_melee to default value ${this.quadMaker.canHandleMelee}`

    case "damage_tolerance":
      this.quadMaker.damageTolerance = QuadSpec.defaultDamageTolerance
      return `reset damage_tolerance to default value ${this.quadMaker.damageTolerance}`

    case "boosts":
      this.quadMaker.boosts = []
      return `reset boosts ${this.quadMaker.boosts.length} boosts`

    case "creep": {
      const listArguments = new ListArguments(args)
      if (listArguments.has(0) !== true) {
        this.quadMaker.creepSpecs = []
        return `reset creep ${this.quadMaker.creepSpecs.length} creeps`
      }
      const resetIndex = listArguments.int(0, "index").parse({ min: 0, max: this.quadMaker.creepSpecs.length - 1 })
      this.quadMaker.creepSpecs.splice(resetIndex, 1)
      return `reset index ${resetIndex}, ${this.quadMaker.creepSpecs.length} creeps`
    }

    case "target_ids":
      this.quadMaker.targetIds = []
      return `reset target_ids ${this.quadMaker.targetIds.length} IDs`

    case "codename":
      this.quadMaker.quadProcessCodename = null
      return "reset codename"

    case "waypoints":
      throw "\"waypoints\" is just an alias to GameMap driver, not able to reset"

    case "quad_waypoints":
      this.quadMaker.waypoints = null
      return "reset quad waypoints"

    case "quad_action":
      this.quadMaker.action = undefined
      return "reset quad action"

    case "quad_plan":
      this.quadMaker.plan = undefined
      return "reset quad plan"

    default:
      throw `Invalid argument name ${argument}. Available arguments are: ${argumentNames}`
    }
  }

  private launchQuadProcess(args: string[]): string {
    const keywardArguments = new KeywordArguments(args)
    const dryRun = keywardArguments.boolean("dry_run").parseOptional() ?? true
    const delay = keywardArguments.int("delay").parseOptional()

    const launchResult = this.quadMaker.launchQuadProcess(dryRun, delay)
    switch (launchResult.resultType) {
    case "succeeded":
      return launchResult.value.result
    case "failed":
      return launchResult.reason
    }
  }
}
