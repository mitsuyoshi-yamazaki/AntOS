import { Invader } from "game/invader"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { coloredText, describeTime, profileLink, roomLink, shortenedNumber } from "utility/log"
import { RoomName } from "utility/room_name"
import { QuadSpec } from "../../../../submodules/private/attack/quad/quad_spec"
import { QuadMaker } from "../quad_maker/quad_maker"
import { AttackPlanner } from "./attack_planner"

ProcessDecoder.register("AttackRoomProcess", state => {
  return AttackRoomProcess.decode(state as AttackRoomProcessState)
})

type ObserveRecord = {
  readonly claimedPlayerName: string | null
  readonly safemodeEndsAt: number | null
  readonly observedAt: number
  targetRoomPlan: AttackPlanner.TargetRoomPlan | null
}

type TargetRoomInfo = {
  readonly roomName: RoomName
  observeRecord: ObserveRecord | null
}

type CreepKilledLog = {
  case: "creep killed"
  bodyDescription: string
}
type HostileCreepKilledLog = {
  case: "hostile creep killed"
  bodyDescription: string
}
type HostileStructureDestroyedLog = {
  case: "hostile structure destroyed"
  structureType: StructureConstant
}
type Log = CreepKilledLog | HostileCreepKilledLog | HostileStructureDestroyedLog

interface AttackRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomInfo: TargetRoomInfo
  readonly resourceSpent: { [resourceType: string]: number }
  readonly logs: Log[]
}

export class AttackRoomProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get targetRoomName(): RoomName {
    return this.targetRoomInfo.roomName
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly targetRoomInfo: TargetRoomInfo,
    private readonly resourceSpent: { [resourceType: string]: number },
    private readonly logs: Log[],
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): AttackRoomProcessState {
    return {
      t: "AttackRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomInfo: this.targetRoomInfo,
      resourceSpent: this.resourceSpent,
      logs: this.logs,
    }
  }

  public static decode(state: AttackRoomProcessState): AttackRoomProcess {
    return new AttackRoomProcess(state.l, state.i, state.roomName, state.targetRoomInfo, state.resourceSpent, state.logs)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoom: Room, attackPlanner: AttackPlanner.Planner): AttackRoomProcess
  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): AttackRoomProcess
  public static create(...args: [ProcessId, RoomName, Room, AttackPlanner.Planner] | [ProcessId, RoomName, RoomName]): AttackRoomProcess {
    const [processId, roomName] = args

    if (typeof args[2] === "string") {
      const targetRoomName = args[2]
      const targetRoomInfo: TargetRoomInfo = {
        roomName: targetRoomName,
        observeRecord: null,
      }

      return new AttackRoomProcess(Game.time, processId, roomName, targetRoomInfo, {}, [])

    } else {
      const targetRoom = args[2]
      const attackPlanner = (args as [ProcessId, RoomName, Room, AttackPlanner.Planner])[3]

      const targetRoomInfo: TargetRoomInfo = {
        roomName: targetRoom.name,
        observeRecord: observe(roomName, targetRoom, attackPlanner.targetRoomPlan),
      }

      return new AttackRoomProcess(Game.time, processId, roomName, targetRoomInfo, {}, [])
    }
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.targetRoomInfo.roomName),
    ]
    const observeRecord = this.targetRoomInfo.observeRecord
    if (observeRecord != null) {
      if (observeRecord.claimedPlayerName != null) {
        descriptions.push(profileLink(observeRecord.claimedPlayerName))
      }
      descriptions.push(`observed at ${describeTime(Game.time - observeRecord.observedAt)} ago`)
    }
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "erase_room_plan", "launch", "observe"]

    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.showTargetRoomInfo()

      case "erase_room_plan":
        if (this.targetRoomInfo.observeRecord == null) {
          return "not observed yet"
        }
        this.targetRoomInfo.observeRecord.targetRoomPlan = null
        return "ok"

      case "observe":
        return this.observeTargetRoom(components)

      case "launch":
        return this.launch()

      default:
        return `Invalid command ${command}. "help" to show command list`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  /** @throws */
  private observeTargetRoom(args: string[]): string {
    const listArguments = new ListArguments(args)
    const observer = listArguments.visibleGameObject(0, "observer_id").parse()
    if (!(observer instanceof StructureObserver)) {
      throw `${observer} is not observer`
    }
    const observeResult = observer.observeRoom(this.targetRoomName)
    if (observeResult !== OK) {
      throw `observeRoom() failed with ${observeResult}, ${observer}, ${roomLink(this.targetRoomName)}`
    }
    return "ok"
  }

  /** @throws */
  private launch(): string {
    const attackPlan = ((): AttackPlanner.AttackPlan | null => {
      const targetRoomPlan = this.targetRoomInfo.observeRecord?.targetRoomPlan
      if (targetRoomPlan == null) {
        return null
      }
      switch (targetRoomPlan.case) {
      case "none":
        return null
      case "multiple_bunkers":
        return targetRoomPlan.attackPlan
      }
    })()
    if (attackPlan == null) {
      throw `no attack plan for ${roomLink(this.targetRoomInfo.roomName)}`
    }

    switch (attackPlan.case) {
    case "none":
      throw `attack plan cannot be created: ${attackPlan.reason}`
    case "single_creep":
      return this.launchSingleCreepAttack(attackPlan)
    case "single_quad":
      return this.launchSingleQuadAttack(attackPlan)
    }
  }

  /** @throws */
  private launchSingleCreepAttack(attackPlan: AttackPlanner.AttackPlanSingleCreep): string {
    const quadSpec = new QuadSpec(
      `${this.targetRoomName}-single-creep`,
      false,
      QuadSpec.defaultDamageTolerance,
      attackPlan.boosts,
      [{
        body: attackPlan.body,
      }],
    )
    const quadMaker = QuadMaker.create(quadSpec, this.roomName, this.targetRoomInfo.roomName)

    const launchResult = quadMaker.launchQuadProcess(false, null)
    switch (launchResult.resultType) {
    case "succeeded":
      return launchResult.value.result
    case "failed":
      throw launchResult.reason
    }
  }

  /** @throws */
  private launchSingleQuadAttack(attackPlan: AttackPlanner.AttackPlanSingleQuad): string {
    const quadSpec = QuadSpec.decode(attackPlan.quadSpecState)
    const quadMaker = QuadMaker.create(quadSpec, this.roomName, this.targetRoomInfo.roomName)

    const launchResult = quadMaker.launchQuadProcess(false, null)
    switch (launchResult.resultType) {
    case "succeeded":
      return launchResult.value.result
    case "failed":
      throw launchResult.reason
    }
  }

  private showTargetRoomInfo(): string {
    if (this.targetRoomInfo.observeRecord == null) {
      return `${roomLink(this.targetRoomInfo.roomName)} not observed`
    }
    const targetRoomPlan = this.targetRoomInfo.observeRecord.targetRoomPlan
    if (targetRoomPlan == null) {
      return `${roomLink(this.targetRoomInfo.roomName)} no room plan`
    }
    const targetRoomPlanDescription = AttackPlanner.describeTargetRoomPlan(targetRoomPlan)

    switch (targetRoomPlan.case) {
    case "none":
      return targetRoomPlanDescription
    case "multiple_bunkers":
      break
    }

    const totalDismantlePower = ((): number => {
      const attackPlan = targetRoomPlan.attackPlan
      switch (attackPlan.case) {
      case "none":
        return 0
      case "single_creep": {
        const quadSpec = new QuadSpec("auto-single", false, QuadSpec.defaultDamageTolerance, attackPlan.boosts, [{body: attackPlan.body}])
        const quadPower = quadSpec.totalPower()
        return quadPower.attack + quadPower.ranged_attack + quadPower.dismantle
      }
      case "single_quad": {
        const quadSpec = QuadSpec.decode(attackPlan.quadSpecState)
        const quadPower = quadSpec.totalPower()
        return quadPower.attack + quadPower.ranged_attack + quadPower.dismantle
      }
      }
    })()

    const bunkerDescriptions: string[] = targetRoomPlan.bunkers.map(bunker => {
      const wallHits = bunker.targetWalls.reduce((result, wall) => result + wall.rampartHits, 0)
      const towerRampartHits = bunker.towers.reduce((result, tower) => result + tower.rampartHits, 0)
      const estimatedWallHitsToDestroyTowers = wallHits + towerRampartHits
      const estimatedDestroyTime = describeTime(Math.ceil(estimatedWallHitsToDestroyTowers / totalDismantlePower))

      return [
        `- ${bunker.towers.length} towers`,
        `${bunker.spawns.length} spawns`,
        `estimated hits to destroy towers: ${shortenedNumber(estimatedWallHitsToDestroyTowers)} (${estimatedDestroyTime})`
      ].join(", ")
    })
    const info: string[] = [
      `calculated at ${describeTime(Game.time - targetRoomPlan.calculatedAt)} ago, ${targetRoomPlan.bunkers.length} bunkers`,
      ...bunkerDescriptions,
      targetRoomPlanDescription,
    ]
    return info.join("\n")
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomInfo.roomName]
    if (targetRoom == null) {
      return  // TODO: Observe
    }

    const updatedObserveRecord = observe(this.roomName, targetRoom, this.targetRoomInfo.observeRecord?.targetRoomPlan ?? null)

    if (updatedObserveRecord.claimedPlayerName == null) {
      PrimitiveLogger.notice(`${this.identifier} ${roomLink(this.targetRoomInfo.roomName)} is no longer occupied`)
      OperatingSystem.os.suspendProcess(this.processId)
    }

    this.targetRoomInfo.observeRecord = updatedObserveRecord
  }
}

function observe(parentRoomName: RoomName, targetRoom: Room, calculatedTargetRoomPlan: AttackPlanner.TargetRoomPlan | null): ObserveRecord {
  const playerName = ((): string | null => {
    if (targetRoom.controller?.owner?.username != null) {
      return targetRoom.controller.owner.username
    }
    if (targetRoom.roomType === "source_keeper") {
      return Invader.username
    }
    return null
  })()

  const controller = targetRoom.controller

  const safemodeEndsAt = ((): number | null => {
    if (controller == null) {
      return null
    }
    if (controller.safeMode == null) {
      return null
    }
    return controller.safeMode + Game.time
  })()

  const targetRoomPlan = ((): AttackPlanner.TargetRoomPlan => {
    if (calculatedTargetRoomPlan != null) {
      return calculatedTargetRoomPlan
    }
    const planner = new AttackPlanner.Planner(targetRoom)
    return planner.targetRoomPlan
  })()

  const observeRecord: ObserveRecord = {
    claimedPlayerName: playerName,
    observedAt: Game.time,
    safemodeEndsAt,
    targetRoomPlan,
  }

  return observeRecord
}
