import { State } from "os/infrastructure/state"
import { Timestamp } from "utility/timestamp"

export type DeclarationFinishCondition = "one time" | "continuous"

export interface DeclarationState extends State {
  readonly launchTime: Timestamp
  readonly finishCondition: DeclarationFinishCondition
}
