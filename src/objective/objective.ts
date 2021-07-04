import { Problem } from "./problem"

export class ObjectiveStatusNotAchieved {
  public readonly objectiveStatus = "not achieved"

  public constructor(public readonly problems: Problem[]) { }
}

export class ObjectiveStatusAchieved {
  public readonly objectiveStatus = "achieved"
}

export type ObjectiveStatus = ObjectiveStatusAchieved | ObjectiveStatusNotAchieved

export interface Objective {
  currentStatus(): ObjectiveStatus
}
