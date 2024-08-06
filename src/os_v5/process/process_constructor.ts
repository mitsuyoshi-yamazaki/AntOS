import type { AnyProcess, AnyProcessId } from "./process"

export type IndependentProcessConstructor = {
  create(processId: AnyProcessId): AnyProcess
}

export type DriverProcessConstructor = IndependentProcessConstructor
