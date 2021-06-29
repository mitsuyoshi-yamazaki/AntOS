import { Process } from "objective/process"
import { TestProcess } from "objective/test/test_process"
import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { ClaimRoomProcess } from "objective/bootstrap_room/old_claim_room_process"
import { OldClaimRoomObjective } from "objective/bootstrap_room/old_claim_room_objective"
import { BootstrapL8RoomObjective } from "objective/bootstrap_room/bootstarp_l8_room_objective"
import { BootstrapL8RoomProcess } from "objective/bootstrap_room/bootstrap_l8_room_proces"
import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"
import { InterShardCreepDelivererProcess } from "objective/creep_provider/inter_shard_creep_deliverer_process"
import { InterShardCreepDelivererObjective } from "objective/creep_provider/inter_shard_creep_deliverer_objective"
import { generateUniqueCodename, generateUniqueId } from "utility/unique_id"
import { spawnPriorityLow } from "objective/spawn/spawn_creep_objective"

type LaunchCommandResult = ResultType<Process, string>

export class LaunchCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    let result: LaunchCommandResult | null = null
    switch (this.args[0]) {
    case "TestProcess":
      result = this.launchTestProcess()
      break
    case "BootstrapL8RoomProcess":
      result = this.launchBootstrapL8RoomProcess()
      break
    case "ClaimRoomProcess":
      result = this.launchClaimRoomProcess()
      break
    case "InterShardCreepDelivererProcess":
      result = this.launchInterShardCreepDelivererProcess()
      break
    default:
      break
    }
    if (result == null) {
      return `Invalid process type name ${this.args[0]}`
    }

    switch (result.resultType) {
    case "succeeded": {
      let detail = ""
      if (this.options.get("-l") != null) {
        const logger = OperatingSystem.os.getLoggerProcess()
        if (logger) {
          const loggerResult = logger.didReceiveMessage(`add id ${result.value.processId}`)
          detail = `, ${loggerResult}`
        } else {
          detail = ", missing logger process"
        }
      }
      return `Launched ${result.value.constructor.name}, PID: ${result.value.processId}${detail}`
    }
    case "failed":
      return result.reason
    }
  }

  // ---- Argument parser ---- //
  private parseProcessArguments(): Map<string, string> {
    const args = this.args.concat([])
    args.splice(0, 1)
    const result = new Map<string, string>()
    args.forEach(arg => {
      const components = arg.split("=")
      if (components.length !== 2) {
        return
      }
      result.set(components[0], components[1])
    })
    return result
  }

  private missingArgumentError(argumentName: string): ResultFailed<string> {
    return new ResultFailed(`Missing ${argumentName} argument`)
  }

  // ---- Launcher ---- //
  private launchTestProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(processId => {
      return new TestProcess(Game.time, processId)
    })
    return new ResultSucceeded(process)
  }

  private launchBootstrapL8RoomProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }

    const parentRoomName = args.get("parent_room_name")
    if (parentRoomName == null) {
      return this.missingArgumentError("parent_room_name")
    }

    const launchTime = Game.time
    const objective = new BootstrapL8RoomObjective(launchTime, [], targetRoomName, parentRoomName)

    const process = OperatingSystem.os.addProcess(processId => {
      return new BootstrapL8RoomProcess(launchTime, processId, objective)
    })
    return new ResultSucceeded(process)
  }

  private launchClaimRoomProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }

    const parentRoomName = args.get("parent_room_name")
    if (parentRoomName == null) {
      return this.missingArgumentError("parent_room_name")
    }

    const launchTime = Game.time
    const objective = new OldClaimRoomObjective(launchTime, [], targetRoomName, parentRoomName, null)

    const process = OperatingSystem.os.addProcess(processId => {
      return new ClaimRoomProcess(launchTime, processId, objective)
    })
    return new ResultSucceeded(process)
  }

  private launchInterShardCreepDelivererProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const portalRoomName = args.get("portal_room_name")
    if (portalRoomName == null) {
      return this.missingArgumentError("portal_room_name")
    }

    const parentRoomName = args.get("parent_room_name")
    if (parentRoomName == null) {
      return this.missingArgumentError("parent_room_name")
    }

    const shardName = args.get("shard_name")
    if (shardName == null) {
      return this.missingArgumentError("shard_name")
    }

    const creepType = args.get("creep_type")
    if (creepType == null) {
      return this.missingArgumentError("creep_type")
    }

    const body = ((): BodyPartConstant[] | null => {
      switch (creepType) {
      case "scout":
        return [MOVE]
      case "armored_scout":
        return [TOUGH, TOUGH, MOVE, MOVE]
      case "minimum_worker":
        return [WORK, CARRY, MOVE, MOVE]
      case "worker":
        return [
          WORK, CARRY, MOVE, MOVE,
          WORK, CARRY, MOVE, MOVE,
          WORK, CARRY, MOVE, MOVE,
        ]
      case "claimer":
        return [CLAIM, MOVE]
      default:
        return null
      }
    }) ()
    if (body == null) {
      return new ResultFailed("Invalid creep_type, available types: scout, armored_scout, minimum_worker, worker, claimer")
    }

    const launchTime = Game.time
    const creepName = generateUniqueId(generateUniqueCodename("InterShardCreepDelivererObjective", launchTime))
    const objective = new InterShardCreepDelivererObjective(
      launchTime,
      [],
      creepName,
      portalRoomName,
      shardName,
      {
        spawnRoomName: parentRoomName,
        requestingCreepBodyParts: body,
        priority: spawnPriorityLow,
      }
    )

    const process = OperatingSystem.os.addProcess(processId => {
      return new InterShardCreepDelivererProcess(launchTime, processId, objective)
    })
    return new ResultSucceeded(process)

  }
}
