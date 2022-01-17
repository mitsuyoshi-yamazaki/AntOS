import { OperatingSystem } from "os/os"
import { Result, ResultFailed } from "utility/result"
import { SpecializedQuadProcess } from "../../../submodules/attack/quad/quad_process"
import { isQuadType } from "../../../submodules/attack/quad/quad_spec"

export function launchQuadProcess(args: Map<string, string>): Result<SpecializedQuadProcess, string> {
  const roomName = args.get("room_name")
  if (roomName == null) {
    return missingArgumentError("room_name")
  }
  const targetRoomName = args.get("target_room_name")
  if (targetRoomName == null) {
    return missingArgumentError("target_room_name")
  }
  const rawWaypoints = args.get("waypoints")
  if (rawWaypoints == null) {
    return missingArgumentError("waypoints")
  }
  const waypoints = rawWaypoints.split(",")
  const rawTargets = args.get("targets")
  if (rawTargets == null) {
    return missingArgumentError("targets")
  }
  const targets = rawTargets.split(",")
  const quadType = args.get("quad_type")
  if (quadType == null) {
    return missingArgumentError("quad_type")
  }
  if (!isQuadType(quadType)) {
    return Result.Failed(`Unrecognized quad type ${quadType}`)
  }

  const process = OperatingSystem.os.addProcess(null, processId => {
    return SpecializedQuadProcess.create(processId, roomName, targetRoomName, waypoints, targets as Id<AnyStructure>[], quadType)
  })
  return Result.Succeeded(process)

}

function missingArgumentError(argumentName: string): ResultFailed<string> {
  return Result.Failed(`Missing ${argumentName} argument`)
}
