import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, roomLink } from "utility/log"
import { RoomCoordinate, RoomCoordinateState, RoomName } from "utility/room_name"
import { Timestamp } from "utility/timestamp"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { Position } from "prototype/room_position"
import { GameConstants } from "utility/constants"
import { OperatingSystem } from "os/os"
import { AttackPlanner } from "./attack_planner"
import { AttackRoomProcess } from "./attack_room_process"
import { processLog } from "os/infrastructure/logger"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"

ProcessDecoder.register("DraftingRoomProcess", state => {
  return DraftingRoomProcess.decode(state as DraftingRoomProcessState)
})

/**
 * - 経路があるかどうか
 */

const runInterval = 1000000 // 10000  // FixMe: 再計算せず、一度限り
const observerRange = GameConstants.structure.observer.maxRange

type RunningStateWaiting = {
  readonly case: "waiting"
  readonly nextRun: Timestamp
}
type RunningStateRunning = {
  readonly case: "running"
  relativePositionIndex: Position
}
type RunningState = RunningStateWaiting | RunningStateRunning

type CheckedRooms = {
  readonly checkedRoomCount: {
    highway: number
    sourceKeeper: number
    normal: number
  }
  readonly results: {
    readonly attackableRoomNames: RoomName[]
    readonly unattackableRoomNames: RoomName[]
  }
}

type Options = {
  dryRun: boolean
}

export interface DraftingRoomProcessState extends ProcessState {
  readonly roomCoordinateState: RoomCoordinateState
  readonly runningState: RunningState
  readonly observerId: Id<StructureObserver>
  readonly checkedRooms: CheckedRooms
  readonly options: Options
}

export class DraftingRoomProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private readonly roomName: RoomName

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomCoordinate: RoomCoordinate,
    private readonly observerId: Id<StructureObserver>,
    private runningState: RunningState,
    private checkedRooms: CheckedRooms,
    private readonly options: Options,
  ) {
    const roomName = this.roomCoordinate.roomName
    this.taskIdentifier = `${this.constructor.name}_${roomName}`
    this.roomName = roomName
  }

  public encode(): DraftingRoomProcessState {
    return {
      t: "DraftingRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomCoordinateState: this.roomCoordinate.encode(),
      observerId: this.observerId,
      runningState: this.runningState,
      checkedRooms: this.checkedRooms,
      options: this.options,
    }
  }

  public static decode(state: DraftingRoomProcessState): DraftingRoomProcess {
    return new DraftingRoomProcess(state.l, state.i, RoomCoordinate.decode(state.roomCoordinateState), state.observerId, state.runningState, state.checkedRooms, state.options)
  }

  public static create(processId: ProcessId, observer: StructureObserver, roomCoordinate: RoomCoordinate, dryRun: boolean): DraftingRoomProcess {
    PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} DraftingRoomProcess exclusively uses observer: make sure other processes don't use it.`)

    const runningState: RunningStateWaiting = {
      case: "waiting",
      nextRun: Game.time + 1,
    }
    const options: Options = {
      dryRun,
    }

    return new DraftingRoomProcess(Game.time, processId, roomCoordinate, observer.id, runningState, createEmptyCheckedRooms(), options)
  }

  public processShortDescription(): string {
    const checkedRoomCount = Array.from(Object.values(this.checkedRooms.checkedRoomCount)).reduce((total, count) => total + count, 0)

    const descriptions: string[] = [
      roomLink(this.roomName),
      `observed ${checkedRoomCount} rooms`,
      `attackable: ${this.checkedRooms.results.attackableRoomNames.length}`,
      `unattackable: ${this.checkedRooms.results.unattackableRoomNames.length}`,
    ]

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "set_dry_run"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "set_dry_run": {
        const listArguments = new ListArguments(components)
        const dryRun = listArguments.boolean(0, "dry run").parse()
        this.options.dryRun = dryRun
        return "ok"
      }

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    switch (this.runningState.case) {
    case "waiting":
      this.runWaitingState(this.runningState)
      break
    case "running":
      this.runRunningState(this.runningState)
      break
    }
  }

  private runWaitingState(state: RunningStateWaiting): void {
    if (Game.time > state.nextRun) {
      return
    }

    const observeRoomRelativePosition: Position = { x: -observerRange, y: -observerRange }
    this.queueRoomObservation(observeRoomRelativePosition)
    this.runningState = {
      case: "running",
      relativePositionIndex: observeRoomRelativePosition,
    }
    this.checkedRooms = createEmptyCheckedRooms()
  }

  private runRunningState(state: RunningStateRunning): void {
    this.observeRoom(state.relativePositionIndex)

    const nextIndex = this.nextRelativeRoomPositionIndex(state.relativePositionIndex)
    if (nextIndex == null) {
      this.runningState = {
        case: "waiting",
        nextRun: Game.time + runInterval,
      }
      return
    }

    this.queueRoomObservation(nextIndex)
    state.relativePositionIndex = nextIndex
  }

  private nextRelativeRoomPositionIndex(currentIndex: Position): Position | null {
    const nextIndex = ((): Position => {
      const x = currentIndex.x + 1
      if (x > observerRange) {
        return {
          x: -observerRange,
          y: currentIndex.y + 1,
        }
      }
      return {
        x,
        y: currentIndex.y
      }
    })()

    if (nextIndex.x === 0 && nextIndex.y === 0) {
      return this.nextRelativeRoomPositionIndex(nextIndex)
    }
    if (nextIndex.y > observerRange) {
      return null
    }
    return nextIndex
  }

  private queueRoomObservation(relativeRoomPosition: Position): void {
    const observer = Game.getObjectById(this.observerId)
    if (observer == null) {
      PrimitiveLogger.fatal(`${this.taskIdentifier} observer ${this.observerId} in ${roomLink(this.roomName)} lost`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const targetRoomName = this.getTargetRoomName(relativeRoomPosition)
    const result = observer.observeRoom(targetRoomName)

    switch (result) {
    case OK:
      break

    case ERR_NOT_OWNER:
    case ERR_NOT_IN_RANGE:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.fatal(`${this.taskIdentifier} observe ${roomLink(targetRoomName)} from ${roomLink(this.roomName)} failed with: ${result}`)
      break
    }
  }

  private observeRoom(relativeRoomPosition: Position): void {
    const targetRoomName = this.getTargetRoomName(relativeRoomPosition)
    const targetRoom = Game.rooms[targetRoomName]
    if (targetRoom == null) {
      PrimitiveLogger.programError(`${this.taskIdentifier} target room ${roomLink(targetRoomName)} is not visible`)
      return
    }

    switch (targetRoom.roomType) {
    case "normal":
      this.checkedRooms.checkedRoomCount.normal += 1
      this.observeNormalRoom(targetRoom)
      break
    case "source_keeper":
    case "sector_center":
      this.checkedRooms.checkedRoomCount.sourceKeeper += 1
      this.observeSourceKeeperRoom(targetRoom)
      break
    case "highway":
    case "highway_crossing":
      this.checkedRooms.checkedRoomCount.highway += 1
      break
    }
  }

  private observeNormalRoom(targetRoom: Room): void {
    const controller = targetRoom.controller
    if (controller == null || controller.owner == null || controller.owner.username === Game.user.name) {
      return
    }

    this.calculateAttackPlan(targetRoom)
  }

  private observeSourceKeeperRoom(targetRoom: Room): void {
    if (targetRoom.find(FIND_HOSTILE_STRUCTURES, { filter: {structureType: STRUCTURE_INVADER_CORE}}).length <= 0) {
      return
    }

    this.calculateAttackPlan(targetRoom)
  }

  private calculateAttackPlan(targetRoom: Room): void {
    const attackPlanner = new AttackPlanner.Planner(this.roomName, targetRoom)
    const attackPlan = attackPlanner.targetRoomPlan.attackPlan
    if (attackPlan.case === "none") {
      // processLog(this, `cannot plan attack for ${roomLink(targetRoom.name)}`)
      this.checkedRooms.results.unattackableRoomNames.push(targetRoom.name)
      return
    }

    this.checkedRooms.results.attackableRoomNames.push(targetRoom.name)

    if (this.options.dryRun === true) {
      processLog(this, `(dry run) ${attackPlan.case} attack plan for ${roomLink(targetRoom.name)}`)
    } else {
      const attackProcess = OperatingSystem.os.addProcess(null, processId => {
        return AttackRoomProcess.create(processId, this.roomName, targetRoom, attackPlanner)
      })

      processLog(this, `launched AttackRoomProcess ${attackProcess.processId} with ${attackPlan.case} attack plan for ${roomLink(targetRoom.name)}`)
    }
  }

  private getTargetRoomName(relativePosition: Position): RoomName {
    return this.roomCoordinate.getRoomCoordinateTo(relativePosition).roomName
  }
}

function createEmptyCheckedRooms(): CheckedRooms {
  return {
    checkedRoomCount: {
      highway: 0,
      sourceKeeper: 0,
      normal: 0,
    },
    results: {
      attackableRoomNames: [],
      unattackableRoomNames: [],
    }
  }
}
