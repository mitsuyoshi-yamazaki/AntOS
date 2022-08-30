import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "shared/utility/room_name"
import { coloredText } from "utility/log"
import { ProcessState } from "process/process_state"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { CreepName } from "prototype/creep"

ProcessDecoder.register("SelfAwareCreepProcess", state => {
  return SelfAwareCreepProcess.decode(state as SelfAwareCreepProcessState)
})

type CreepSpec = {
  //
}
type FixedCreepSpec = CreepSpec & {
  readonly case: "fixed"
  readonly bodyDescription: string
}
type EditingCreepSpec = Partial<CreepSpec> & {
  readonly case: "editing"
  readonly body: BodyPartConstant[]
}
type CreepSpecType = FixedCreepSpec | EditingCreepSpec

type CreepStateNotSpawned = {
  readonly case: "not-spawned"
}
type CreepStateRunning = {
  readonly case: "running"
  readonly name: CreepName
}
type CreepStateDead = {
  readonly case: "dead"
}
type CreepState = CreepStateNotSpawned | CreepStateRunning | CreepStateDead

type EventLog = void // TODO:

export interface SelfAwareCreepProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly creepSpec: CreepSpecType
  readonly creepState: CreepState
  readonly logs: EventLog[]
}

/**
 * - Creepを寿命まで生き延びさせる
 * - 評価を行う
 *   - 寿命を全うしたか
 *   - 何を成したか（通常の重要度とは異なる
 */
export class SelfAwareCreepProcess implements Process, Procedural, MessageObserver {
  public taskIdentifier: string

  private readonly codename = "explorer"

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private creepSpec: CreepSpecType,
    private readonly creepState: CreepState,
    private readonly logs: EventLog[],
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.processId}`
  }

  public encode(): SelfAwareCreepProcessState {
    return {
      t: "SelfAwareCreepProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      creepSpec: this.creepSpec,
      creepState: this.creepState,
      logs: this.logs,
    }
  }

  public static decode(state: SelfAwareCreepProcessState): SelfAwareCreepProcess {
    return new SelfAwareCreepProcess(
      state.l,
      state.i,
      state.roomName,
      state.creepSpec,
      state.creepState,
      state.logs,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName): SelfAwareCreepProcess {
    const creepState: CreepStateNotSpawned = {
      case: "not-spawned",
    }

    const creepSpec: EditingCreepSpec = {
      case: "editing",
      body: [],
    }

    return new SelfAwareCreepProcess(
      Game.time,
      processId,
      roomName,
      creepSpec,
      creepState,
      [],
    )
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
    ]
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "edit"]

    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        throw "not implemented yet"

      case "edit":
        return this.edit(components)

      default:
        return `Invalid command ${command}. "help" to show command list`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  /** @throws */
  private edit(args: string[]): string {
    throw "not implemented yet"
  }

  public runOnTick(): void {
  }
}
