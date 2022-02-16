import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { isValidRoomName, RoomName } from "utility/room_name"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { QuadCreepSpec, QuadSpec } from "../../../submodules/private/attack/quad/quad_spec"
import { isMineralBoostConstant } from "utility/resource"
import { CreepBody, isBodyPartConstant } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { Result, ResultFailed } from "utility/result"
import { OperatingSystem } from "os/os"
import { SpecializedQuadLaunchArguments, SpecializedQuadProcess } from "../../../submodules/private/attack/quad/quad_process"
import { GameMap } from "game/game_map"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { LaunchQuadProcess } from "./attack/launch_quad_process"
import { KeywordArguments } from "os/infrastructure/console_command/utility/keyword_argument_parser"

ProcessDecoder.register("QuadMakerProcess", state => {
  return QuadMakerProcess.decode(state as QuadMakerProcessState)
})

const canHandleMeleeDefaultValue = false
const defaultDamageTolerance = 0.15
const parameterNames = ["room_name", "target_room_name", "front_base_room_name"]
const argumentNames = ["handle_melee", "damage_tolerance", "boosts", "creep", "target_ids"]

interface QuadMakerProcessState extends ProcessState {
  readonly quadName: string
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly frontBaseRoomName: RoomName | null
  readonly canHandleMelee: boolean
  readonly damageTolerance: number, // 0.0~1.0
  readonly boosts: MineralBoostConstant[],
  readonly creepSpecs: QuadCreepSpec[],
  readonly targetIds: Id<AnyCreep | AnyStructure>[],
}

export class QuadMakerProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly quadName: string,
    private roomName: RoomName,
    private targetRoomName: RoomName,
    private frontBaseRoomName: RoomName | null,
    private canHandleMelee: boolean,
    private damageTolerance: number,
    private boosts: MineralBoostConstant[],
    private creepSpecs: QuadCreepSpec[],
    private targetIds: Id<AnyCreep | AnyStructure>[],
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}_${quadName}_${this.targetRoomName}`
  }

  public encode(): QuadMakerProcessState {
    return {
      t: "QuadMakerProcess",
      l: this.launchTime,
      i: this.processId,
      quadName: this.quadName,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      frontBaseRoomName: this.frontBaseRoomName,
      canHandleMelee: this.canHandleMelee,
      damageTolerance: this.damageTolerance,
      boosts: this.boosts,
      creepSpecs: this.creepSpecs,
      targetIds: this.targetIds,
    }
  }

  public static decode(state: QuadMakerProcessState): QuadMakerProcess {
    return new QuadMakerProcess(
      state.l,
      state.i,
      state.quadName,
      state.roomName,
      state.targetRoomName,
      state.frontBaseRoomName,
      state.canHandleMelee,
      state.damageTolerance,
      state.boosts,
      state.creepSpecs,
      state.targetIds ?? [],
    )
  }

  public static create(processId: ProcessId, quadName: string, roomName: RoomName, targetRoomName: RoomName): QuadMakerProcess {
    const frontBaseRoomName: RoomName | null = null
    const canHandleMelee = canHandleMeleeDefaultValue
    const damageTolerance = defaultDamageTolerance
    const boosts: MineralBoostConstant[] = []
    const creepSpec: QuadCreepSpec[] = []
    return new QuadMakerProcess(Game.time, processId, quadName, roomName, targetRoomName, frontBaseRoomName, canHandleMelee, damageTolerance, boosts, creepSpec, [])
  }

  public processShortDescription(): string {
    return `${this.quadName} ${this.roomPathDescription()}`
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
      return this.show()

    case "verify": {
      const result = this.verify()
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
      throw "not implemented yet"

    default:
      throw `Invalid command ${command}. see "help"`
    }
  }

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
      const oldValue = this.roomName
      this.roomName = roomName
      return `Changed room_name ${oldValue} =&gt ${this.roomName}`
    }

    case "target_room_name": {
      const targetRoomName = args[0]
      if (targetRoomName == null) {
        throw "Missing target room name argument"
      }
      if (isValidRoomName(targetRoomName) !== true) {
        throw `Invalid target room name ${targetRoomName}`
      }
      const oldValue = this.targetRoomName
      this.targetRoomName = targetRoomName
      return `Changed target_room_name ${oldValue} =&gt ${this.targetRoomName}`
    }

    case "front_base_room_name": {
      const frontBaseRoomName = args[0]
      if (frontBaseRoomName == null) {
        throw "Missing front base room name argument"
      }
      const frontRoom = Game.rooms[frontBaseRoomName]
      if (frontRoom == null || frontRoom.controller?.my !== true) {
        throw `Front room ${roomLink(frontBaseRoomName)} is not mine`
      }
      const oldValue = this.frontBaseRoomName
      this.frontBaseRoomName = frontBaseRoomName
      return `Changed front_base_room_name ${oldValue} =&gt ${this.frontBaseRoomName}`
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
      this.canHandleMelee = handleMelee === "1"
      return `set handle_melee=${this.canHandleMelee}`
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
      this.damageTolerance = value
      return `set damage_tolerance=${this.damageTolerance}`
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

      this.boosts = boosts
      return `set boosts=${this.boosts}`
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
      this.creepSpecs.push(...newCreepSpecs)
      return `set ${newCreepSpecs.length} ${CreepBody.description(body)}, ${bodyDescription}`
    }

    case "target_ids": {
      const listArguments = new ListArguments(args)
      const targetIds = listArguments.string(0, "target ids").parse().split(",")
      this.targetIds = targetIds as Id<AnyCreep | AnyStructure>[]
      return `set target IDs ${this.targetIds.join(", ")}`
    }

    default:
      throw `Invalid argument name ${argument}. Available arguments are: ${argumentNames}`
    }
  }

  private reset(args: string[]): string {
    const argument = args.shift()

    switch (argument) {
    case "handle_melee":
      this.canHandleMelee = canHandleMeleeDefaultValue
      return `reset handle_melee to default value ${this.canHandleMelee}`

    case "damage_tolerance":
      this.damageTolerance = defaultDamageTolerance
      return `reset damage_tolerance to default value ${this.damageTolerance}`

    case "boosts":
      this.boosts = []
      return `reset boosts ${this.boosts.length} boosts`

    case "creep": {
      const listArguments = new ListArguments(args)
      if (listArguments.has(0) !== true) {
        this.creepSpecs = []
        return `reset creep ${this.creepSpecs.length} creeps`
      }
      const resetIndex = listArguments.int(0, "index").parse({ min: 0, max: this.creepSpecs.length - 1 })
      this.creepSpecs.splice(resetIndex, 1)
      return `reset index ${resetIndex}, ${this.creepSpecs.length} creeps`
    }

    case "target_ids":
      this.targetIds = []
      return `reset target_ids ${this.targetIds.length} IDs`

    default:
      throw `Invalid argument name ${argument}. Available arguments are: ${argumentNames}`
    }
  }

  private roomPathDescription(): string {
    const roomNames: RoomName[] = []
    roomNames.push(this.roomName)
    if (this.frontBaseRoomName != null) {
      roomNames.push(this.frontBaseRoomName)
    }
    roomNames.push(this.targetRoomName)

    return roomNames.map(roomName => roomLink(roomName)).join("=>")
  }

  private show(): string {
    const quadSpec = this.createQuadSpec()
    if (typeof quadSpec === "string") {
      return `${quadSpec}:
${this.quadName} ${this.roomPathDescription()}
handle melee: ${ this.canHandleMelee }
damage tolerance: ${ this.damageTolerance }
boosts: ${this.boosts.map(boost => coloredResourceType(boost)).join(",")}
creeps: ${this.creepSpecs.length} creeps
targets: ${this.targetIds.length} target IDs
      `
    }

    const descriptions: string[] = [
      this.roomPathDescription()
    ]
    if (this.targetIds.length > 0) {
      descriptions.push(`${this.targetIds.length} targets`)
    }
    descriptions.push(quadSpec.description())
    return descriptions.join("\n")
  }

  private verify(): Result<{ quadSpec: QuadSpec, warnings: string[] }, string[]> {
    const warningPrefix = coloredText("[WARN]", "warn")
    const errorPrefix = coloredText("[ERROR]", "error")
    const warnings: string[] = []
    const errors: string[] = []

    const resultFailed = (): ResultFailed<string[]> => {
      errors.push(...warnings)
      return Result.Failed(errors)
    }

    const noWaypointError = (fromRoomName: RoomName, toRoomName: RoomName): string => {
      return `${errorPrefix} waypoints not set ${roomLink(fromRoomName)}=>${roomLink(toRoomName)}`
    }
    if (this.frontBaseRoomName != null) {
      if (GameMap.getWaypoints(this.roomName, this.frontBaseRoomName) == null) {
        errors.push(noWaypointError(this.roomName, this.frontBaseRoomName))
      }
      if (GameMap.getWaypoints(this.frontBaseRoomName, this.targetRoomName) == null) {
        errors.push(noWaypointError(this.frontBaseRoomName, this.targetRoomName))
      }
    } else {
      if (GameMap.getWaypoints(this.roomName, this.targetRoomName) == null) {
        errors.push(noWaypointError(this.roomName, this.targetRoomName))
      }
    }

    const roomResources = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResources == null) {
      errors.push(`${errorPrefix} ${roomLink(this.roomName)} is not mine`)
      return resultFailed()
    }
    const quadSpec = this.createQuadSpec()
    if (typeof quadSpec === "string") {
      errors.push(`${errorPrefix} ${quadSpec}`)
      return resultFailed()
    }

    const moveTier = ((): 0 | 1 | 2 | 3 => {
      if (this.boosts.includes(RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE) === true) {
        return 3
      }
      if (this.boosts.includes(RESOURCE_ZYNTHIUM_ALKALIDE) === true) {
        return 2
      }
      if (this.boosts.includes(RESOURCE_ZYNTHIUM_OXIDE) === true) {
        return 1
      }
      return 0
    })()
    warnings.push(...this.creepSpecs.flatMap(spec => {
      const warning = this.verifyMoveCount([...spec.body], moveTier)
      if (warning != null) {
        return [`${warningPrefix} ${warning}`]
      }
      return []
    }))

    const creepSpecErrors: string[] = this.creepSpecs.flatMap(spec => {
      if (spec.body.length > GameConstants.creep.body.bodyPartMaxCount) {
        return [`${errorPrefix} over body limit (${spec.body.length} parts) ${CreepBody.description(spec.body)}`]
      }
      return []
    })
    errors.push(...creepSpecErrors)

    const energyCapacityAvailable = roomResources.room.energyCapacityAvailable
    this.creepSpecs.forEach(spec => {
      const creepCost = CreepBody.cost(spec.body)
      if (creepCost > energyCapacityAvailable) {
        errors.push(`${errorPrefix} lack of energy capacity: required ${creepCost}e but capacity is ${energyCapacityAvailable} in ${roomLink(this.roomName)}`)
      }
    })

    const cost = quadSpec.energyCost()
    const storedEnergy = (roomResources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (roomResources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
    if (cost > storedEnergy) {
      errors.push(`${errorPrefix} lack of energy: required ${cost}e but ${storedEnergy}e in ${roomLink(this.roomName)}`)
      return resultFailed()
    }
    const safeEnergyAmount = Math.min(cost * 3, cost + 20000)
    if (safeEnergyAmount > storedEnergy) {
      warnings.push(`${warningPrefix} quad may cause energy shortage: required ${cost}e but ${storedEnergy}e in ${roomLink(this.roomName)}`)
    }

    if (errors.length <= 0) {
      return Result.Succeeded({
        quadSpec,
        warnings,
      })
    }
    return resultFailed()
  }

  private verifyMoveCount(body: BodyPartConstant[], moveTier: 0 | 1 | 2 | 3): string | null {
    const moveCount = body.reduce((result, current) => {
      if (current !== MOVE) {
        return result
      }
      return result + 1
    }, 0)
    const bodyCount = body.length - moveCount

    const movePower = moveCount * (moveTier + 1)
    if (bodyCount <= movePower) {
      return null
    }
    return `lack of move power: tier${moveTier} ${moveCount}MOVE, ${bodyCount} body`
  }

  private launchQuadProcess(args: string[]): string {
    const keywardArguments = new KeywordArguments(args)
    const dryRun = keywardArguments.boolean("dry_run").parseOptional() ?? true
    const delay = keywardArguments.int("delay").parseOptional()

    const parameterDescriptions: string[] = []
    if (dryRun === true) {
      parameterDescriptions.push("(dry run: set dry_run=0 to launch)")
    }
    if (delay != null) {
      parameterDescriptions.push(`delayed: ${delay} ticks`)
    }

    const result = this.verify()
    switch (result.resultType) {
    case "failed": {
      return `Launch failed ${parameterDescriptions.join(", ")}\n${result.reason.join("\n")}`
    }
    case "succeeded": {
      if (dryRun === true) {
        const header = `Launchable ${parameterDescriptions.join(", ")}`
        if (result.value.warnings.length > 0) {
          return `${header}\n${result.value.warnings.join("\n")}\n${this.show()}`
        }
        return `${header}\n${this.show()}`
      }

      const launchArguments: SpecializedQuadLaunchArguments = {
        parentRoomName: this.roomName,
        targetRoomName: this.targetRoomName,
        predefinedTargetIds: this.targetIds,
        frontBaseRoomName: this.frontBaseRoomName,
      }

      const process = ((): Process => {
        if (delay != null) {
          return OperatingSystem.os.addProcess(null, processId => {
            return LaunchQuadProcess.create(processId, { case: "delay", launchTime: Game.time + delay }, launchArguments, result.value.quadSpec)
          })
        }
        return OperatingSystem.os.addProcess(null, processId => {
          return SpecializedQuadProcess.create(processId, launchArguments, result.value.quadSpec)
        })
      })()

      const launchMessage = `${process.constructor.name} launched. Process ID: ${process.processId}`
      if (result.value.warnings.length > 0) {
        return `${launchMessage}\n${result.value.warnings.join("\n")}\n${this.show()}`
      }
      return `${launchMessage}\n${this.show()}`
    }
    }
  }

  private createQuadSpec(): QuadSpec | string {
    if (this.creepSpecs.length <= 0) {
      return "missing creep specification"
    }
    if (this.creepSpecs.length > 4) {
      return `${this.creepSpecs.length} creep specs`
    }
    return new QuadSpec(
      this.quadName,
      this.canHandleMelee,
      this.damageTolerance,
      [...this.boosts],
      [...this.creepSpecs],
    )
  }
}
