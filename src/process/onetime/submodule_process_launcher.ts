import { OperatingSystem } from "os/os"
import { Result, ResultFailed } from "shared/utility/result"
import { SpecializedQuadProcess } from "../../../submodules/private/attack/quad/quad_process"
import { isQuadType, PredefinedQuadSpec } from "../../../submodules/private/attack/quad/predefined_quad_spec"
import { QuadSpec } from "../../../submodules/private/attack/quad/quad_spec"
import { QuadRequirement } from "../../../submodules/private/attack/quad/quad_requirement"

export function launchQuadProcess(args: Map<string, string>): Result<SpecializedQuadProcess, string> {
  const roomName = args.get("room_name")
  if (roomName == null) {
    return missingArgumentError("room_name")
  }
  const targetRoomName = args.get("target_room_name")
  if (targetRoomName == null) {
    return missingArgumentError("target_room_name")
  }
  const rawTargets = args.get("targets")
  if (rawTargets == null) {
    return missingArgumentError("targets")
  }
  const targets = rawTargets.split(",")

  const quadSpec = ((): QuadSpec | string => {
    const quadType = args.get("quad_type")
    if (quadType == null) {
      return "Missing quad_type argument"
    }
    if (isQuadType(quadType)) {
      return (new PredefinedQuadSpec(quadType)).getQuadSpec()
    }
    const requirementResult = QuadRequirement.parse(quadType)
    switch (requirementResult.resultType) {
    case "failed":
      return `${requirementResult.reason}\n(raw argument: ${quadType}`
    case "succeeded":
      break
    }

    const specResult = QuadSpec.create(requirementResult.value)
    switch (specResult.resultType) {
    case "failed":
      return `${specResult.reason}`
    case "succeeded":
      return specResult.value
    }
  })()

  if (typeof quadSpec === "string") {
    return Result.Failed(quadSpec)
  }

  const process = OperatingSystem.os.addProcess(null, processId => {
    return SpecializedQuadProcess.create(processId, {
      parentRoomName: roomName,
      targetRoomName,
      predefinedTargetIds: targets as Id<AnyStructure>[],
      frontBaseRoomName: null,
      waypoints: null,
    }, quadSpec)
  })
  return Result.Succeeded(process)

}

function missingArgumentError(argumentName: string): ResultFailed<string> {
  return Result.Failed(`Missing ${argumentName} argument`)
}
