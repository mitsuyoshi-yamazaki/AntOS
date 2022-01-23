import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { QuadCreepSpec } from "../../../submodules/attack/quad/quad_spec"
import { isMineralBoostConstant } from "utility/resource"
import { CreepBody, isBodyPartConstant } from "utility/creep_body"

ProcessDecoder.register("QuadMakerProcess", state => {
  return QuadMakerProcess.decode(state as QuadMakerProcessState)
})

const canHandleMeleeDefaultValue = false
const defaultDamageTolerance = 0.15
const argumentNames = ["handle_melee", "damage_tolerance", "boosts", "creep"]

interface QuadMakerProcessState extends ProcessState {
  readonly quadName: string
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly canHandleMelee: boolean
  readonly damageTolerance: number, // 0.0~1.0
  readonly boosts: MineralBoostConstant[],
  readonly creepSpecs: QuadCreepSpec[],
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
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private canHandleMelee: boolean,
    private damageTolerance: number,
    private boosts: MineralBoostConstant[],
    private creepSpecs: QuadCreepSpec[],
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
      canHandleMelee: this.canHandleMelee,
      damageTolerance: this.damageTolerance,
      boosts: this.boosts,
      creepSpecs: this.creepSpecs,
    }
  }

  public static decode(state: QuadMakerProcessState): QuadMakerProcess {
    return new QuadMakerProcess(
      state.l,
      state.i,
      state.quadName,
      state.roomName,
      state.targetRoomName,
      state.canHandleMelee,
      state.damageTolerance,
      state.boosts,
      state.creepSpecs,
    )
  }

  public static create(processId: ProcessId, quadName: string, roomName: RoomName, targetRoomName: RoomName): QuadMakerProcess {
    const canHandleMelee = canHandleMeleeDefaultValue
    const damageTolerance = defaultDamageTolerance
    const boosts: MineralBoostConstant[] = []
    const creepSpec: QuadCreepSpec[] = []
    return new QuadMakerProcess(Game.time, processId, quadName, roomName, targetRoomName, canHandleMelee, damageTolerance, boosts, creepSpec)
  }

  public processShortDescription(): string {
    return `${this.quadName} ${roomLink(this.roomName)}=>${roomLink(this.targetRoomName)}`
  }

  public didReceiveMessage(message: string): string {
    const commands = ["help", "set", "reset", "show", "verify", "launch"]
    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `Quad maker
commands: ${commands}

- help
  - show help
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
- launch
  - launch quad process
      `

    case "set":
      return this.set(components)

    case "reset":
      return this.reset(components)

    case "show":
      return this.show()

    case "verify":
      return this.verify()

    case "launch":
      return this.launchQuadProcess()

    default:
      return `Invalid command ${command}. see "help"`
    }
  }

  public runOnTick(): void {
    // does nothing
  }

  private set(args: string[]): string {
    const argument = args.shift()

    switch (argument) {
    case "handle_melee": {
      const handleMelee = args[0]
      if (handleMelee !== "0" && handleMelee !== "1") {
        return `handle_melee value should be "0" or "1" (${handleMelee})`
      }
      this.canHandleMelee = handleMelee === "1"
      return `set handle_melee=${this.canHandleMelee}`
    }

    case "damage_tolerance": {
      const rawValue = args[0]
      if (rawValue == null) {
        return "damage_tolerance no value (set 0.0~1.0)"
      }
      const value = parseFloat(rawValue)
      if (isNaN(value) === true) {
        return "damage_tolerance value is not a number (set 0.0~1.0)"
      }
      if (value < 0 || value > 1) {
        return `damage_tolerance invalid value ${value}. set 0.0~1.0`
      }
      this.damageTolerance = value
      return `set damage_tolerance=${this.damageTolerance}`
    }

    case "boosts": {
      if (args.length <= 0) {
        this.boosts = []
        return `set boosts ${this.boosts} boosts`
      }
      const boosts = ((): MineralBoostConstant[] | string => {
        const result: MineralBoostConstant[] = []
        for (const value of args) {
          if (!isMineralBoostConstant(value)) {
            return `Invalid boost ${value}`
          }
          result.push(value)
        }
        return result
      })()

      if (typeof boosts === "string") {
        return boosts
      }
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
        return "Missing count argument"
      }
      const creepCount = parseInt(rawCount)
      if (isNaN(creepCount) === true) {
        return "count is not a number"
      }

      const bodyDescription = keyValueArgs.get("body")
      if (bodyDescription == null) {
        return "Missing body argument"
      }
      const body = ((): BodyPartConstant[] | string => {
        const bodyComponents = bodyDescription.split(",")
        const result: BodyPartConstant[] = []

        for (const component of bodyComponents) {
          const createErrorMessage = (error: string): string => {
            return `Invalid body format: ${error} in ${component}. body=<count><body part>,<count><body part>,... e.g. body=3TOUGH,3MOVE,10HEAL,10MOVE`
          }
          const parts = component.split(/(\d+)/)
          const rawBodyPartsCount = parts[1]
          if (rawBodyPartsCount == null) {
            return createErrorMessage("missing body count")
          }
          const bodyPartsCount = parseInt(rawBodyPartsCount)
          if (isNaN(bodyPartsCount) === true) {
            return createErrorMessage("body count is not a number")
          }
          const bodyPart = parts[2]
          if (bodyPart == null) {
            return createErrorMessage("missing body part definition")
          }
          if (!isBodyPartConstant(bodyPart)) {
            return createErrorMessage(`invalid body part ${bodyPart}`)
          }
          result.push(...Array(bodyPartsCount).fill(bodyPart))
        }
        return result
      })()

      if (typeof body === "string") {
        return body
      }
      const creepSpec: QuadCreepSpec = {
        body
      }
      const newCreepSpecs = Array(creepCount).fill({ ...creepSpec })
      this.creepSpecs.push(...newCreepSpecs)
      return `set ${newCreepSpecs.length} ${CreepBody.description(body)}, ${bodyDescription}`
    }

    default:
      return `Invalid argument name ${argument}. Available arguments are: ${argumentNames}`
    }
  }

  private reset(args: string[]): string {
    const argument = args.shift()

    switch (argument) {
    case "handle_melee":
      this.canHandleMelee = canHandleMeleeDefaultValue
      return `reset handle_melee=${this.canHandleMelee}`

    case "damage_tolerance":
      this.damageTolerance = defaultDamageTolerance
      return `reset damage_tolerance=${this.damageTolerance}`

    case "boosts":
      this.boosts = []
      return `reset boosts ${this.boosts.length} boosts`

    case "creep":
      this.creepSpecs = []
      return `reset creep ${this.creepSpecs.length} creeps`

    default:
      return `Invalid argument name ${argument}. Available arguments are: ${argumentNames}`
    }
  }

  private show(): string {
    return "not implemented yet"
  }

  private verify(): string {
    return "not implemented yet"
  }

  private launchQuadProcess(): string {
    // TODO: 生存し続けるオプションをつける
    return "not implemented yet"
  }
}
