import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { TerrainCacheProcessApi } from "../../game_object_management/terrain_cache_process"
import { SystemCalls } from "os_v5/system_calls/interface"
import { StampRoomPlan, LayoutMark } from "./stamp_room_plans"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { RoomName } from "shared/utility/room_name_types"
import { AnyPosition, Position } from "shared/utility/position_v2"

type Dependency = TerrainCacheProcessApi

type ManualRoomPlannerProcessState = {
  //
}

ProcessDecoder.register("ManualRoomPlannerProcess", (processId: ManualRoomPlannerProcessId, state: ManualRoomPlannerProcessState) => ManualRoomPlannerProcess.decode(processId, state))

export type ManualRoomPlannerProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, void, ManualRoomPlannerProcessState, ManualRoomPlannerProcess>


export class ManualRoomPlannerProcess extends Process<Dependency, ProcessDefaultIdentifier, void, ManualRoomPlannerProcessState, ManualRoomPlannerProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private constructor(
    public readonly processId: ManualRoomPlannerProcessId,
  ) {
    super()
  }

  public encode(): ManualRoomPlannerProcessState {
    return {
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(processId: ManualRoomPlannerProcessId, state: ManualRoomPlannerProcessState): ManualRoomPlannerProcess {
    return new ManualRoomPlannerProcess(processId)
  }

  public static create(processId: ManualRoomPlannerProcessId): ManualRoomPlannerProcess {
    return new ManualRoomPlannerProcess(processId)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.clearFlagsCommand,
      this.placeStampRoomPlanCommand,
    ])
  }

  public run(): void {
    SystemCalls.processManager.suspend(this)
  }


  // ---- Command Runner ---- //
  private readonly clearFlagsCommand: Command = {
    command: "clear_flags",
    help: (): string => "clear_flags",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const roomName = argumentParser.roomName([0, "room name"]).parse()

      const flags = ((): Flag[] => {
        const room = Game.rooms[roomName]
        if (room != null) {
          return room.find(FIND_FLAGS)
        }
        return Array.from(Object.values(Game.flags)).filter(flag => flag.pos.roomName === roomName)
      })()

      const numberOfFlags = flags.length
      flags.forEach(flag => flag.remove())

      return `Deleted ${numberOfFlags} flags in ${ConsoleUtility.roomLink(roomName)}`
    }
  }

  private readonly placeStampRoomPlanCommand: Command = {
    command: "place_stamp_room_plan",
    help: (): string => "place_stamp_room_plan {room name} plan_name={string} position={x},{y} dry_run={boolean}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const roomName = argumentParser.roomName([0, "room name"]).parse()
      const planName = argumentParser.string("plan_name").parse()
      const plan = StampRoomPlan.getStampRoomPlanByName(planName)
      if (plan == null) {
        throw `No stamp room plan with name ${planName}`
      }

      const position = argumentParser.localPosition("position").parse()
      const dryRun = argumentParser.bool("dry_run").parseOptional() ?? true

      this.placeFlags(plan, roomName, position, dryRun)

      const dryRunDescription = dryRun ? " (dry run)" : ""
      return `Placed ${planName} in ${ConsoleUtility.roomLink(roomName)}${dryRunDescription}`
    }
  }

  /** @throws */
  private placeFlags(plan: StampRoomPlan, roomName: RoomName, position: Position, dryRun: boolean): void {
    const handlePosition = ((): (layoutMark: LayoutMark, position: AnyPosition, primaryColor: ColorConstant, secondaryColor: ColorConstant | undefined) => void => {
      if (dryRun === true) {
        const visual = new RoomVisual(roomName)
        return (layoutMark, position, primaryColor): void => {
          visual.text(layoutMark, position.x, position.y, {
            color: StampRoomPlan.getWebColor(primaryColor),
          })
        }
      }
      return (layoutMark, position, primaryColor, secondaryColor): void => {
        const roomPosition = new RoomPosition(position.x, position.y, roomName)
        roomPosition.createFlag(SystemCalls.uniqueName.generateUniqueFlagName(), primaryColor, secondaryColor)
      }
    })()

    plan.forEach((row, j) => {
      row.forEach((layoutMark, i) => {
        const colors = StampRoomPlan.flagColors[layoutMark]
        if (colors == null) {
          return
        }
        const primaryColor = colors[0]
        const secondaryColor = colors[1]

        handlePosition(layoutMark, { x: position.x + i, y: position.y + j }, primaryColor, secondaryColor)
      })
    })
  }
}
