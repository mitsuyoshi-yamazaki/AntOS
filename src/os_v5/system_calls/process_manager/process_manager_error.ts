import { AnyProcessId, ProcessSpecifier } from "os_v5/process/process"
import { ProcessTypes } from "os_v5/process/process_type_map"

type ProcessManagerErrorAlreadyLaunched = {
  readonly case: "already launched"
  readonly processType: ProcessTypes
  readonly identifier: string
  readonly existingProcessId: AnyProcessId
}
type ProcessManagerErrorLackOfDependencies = {
  readonly case: "lack of dependencies"
  readonly missingDependencies: ProcessSpecifier[]
}
type ProcessManagerErrors = ProcessManagerErrorAlreadyLaunched | ProcessManagerErrorLackOfDependencies

export class ProcessManagerError extends Error {
  public constructor(
    public readonly error: ProcessManagerErrors,
  ) {
    super(((): string => {
      switch (error.case) {
      case "already launched":
        return `${error.processType} with identifier (${error.identifier}) is already launched (process ID: ${error.existingProcessId})`
      case "lack of dependencies": {
        const dependencyDescription = error.missingDependencies.map(dependency => `${dependency.processType}[${dependency.identifier}]`).join(", ")
        return `Lack of dependencies: ${dependencyDescription}`
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = error
        return `${error}`
      }
      }
    })())
  }
}
