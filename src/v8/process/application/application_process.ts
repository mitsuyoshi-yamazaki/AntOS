import { SemanticVersion } from "shared/utility/semantic_version"
import { Process } from "../process"

export type Application = {
  readonly applicationName: string
  readonly version: SemanticVersion
}

export type ApplicationProcess = Process & Application

export const isApplicationProcess = (process: Process): process is ApplicationProcess => {
  if ((process as unknown as Application).applicationName == null) {
    return false
  }
  if (!((process as unknown as Application).version instanceof SemanticVersion)) {
    return false
  }
  return true
}
