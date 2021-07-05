import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OwnedRoomObjects } from "world_info/room_info"
import { Problem } from "./problem"
import { TaskRunner } from "./task_runner"

class ObjectiveStatusNotAchieved {
  public readonly objectiveStatus = "not achieved"

  public constructor(public readonly problems: Problem[]) { }
}

class ObjectiveStatusAchieved {
  public readonly objectiveStatus = "achieved"
}

export type ObjectiveStatus = ObjectiveStatusAchieved | ObjectiveStatusNotAchieved
export const ObjectiveStatus = {
  Achieved: function (): ObjectiveStatusAchieved {
    return new ObjectiveStatusAchieved()
  },
  NotAchieved: function (problems: Problem[]): ObjectiveStatusNotAchieved {
    return new ObjectiveStatusNotAchieved(problems)
  }
}

export interface Objective {
  taskRunners(): TaskRunner[]
  currentStatus(): ObjectiveStatus
}

export interface LaunchableObjective extends Objective {
  type: LaunchableObjectiveType
}

class LaunchableObjectiveMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "ExampleLaunchableObjective" = (objects: OwnedRoomObjects) => new ExampleLaunchableObjective(objects)
}
const objectiveMap = new LaunchableObjectiveMap()

export type LaunchableObjectiveType = keyof LaunchableObjectiveMap

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isLaunchableObjectiveType(arg: string): arg is LaunchableObjectiveType {
  return Object.keys(objectiveMap).includes(arg)
}

export function createObjective(type: LaunchableObjectiveType, objects: OwnedRoomObjects): Objective | null {
  const result = ErrorMapper.wrapLoop((): Objective | null => {
    const maker = objectiveMap[type]
    if (maker == null) {
      const message = `Create failed by program bug: missing decoder (objective type identifier: ${type})`
      PrimitiveLogger.fatal(message)
      return null
    }
    return maker(objects)
  }, `createObjective(), objective type: ${type}`)()

  if (result == null) {
    const message = `Create failed by program bug (objective type identifier: ${type})`
    PrimitiveLogger.fatal(message)
    return null
  }
  return result
}

export function createObjectives(types: LaunchableObjectiveType[], objects: OwnedRoomObjects): Objective[] {
  return types.reduce((result, current) => {
    const objective = createObjective(current, objects)
    if (objective != null) {
      result.push(objective)
    }
    return result
  }, [] as Objective[])
}

class ExampleLaunchableObjective implements LaunchableObjective {
  public readonly type = "ExampleLaunchableObjective"
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(objects: OwnedRoomObjects) { }

  public taskRunners(): TaskRunner[] {
    return []
  }
  public currentStatus(): ObjectiveStatus {
    return ObjectiveStatus.Achieved()
  }
}
