import { ScoutCreepProcess } from "process/creep/scout_creep"
import { ProcessId, Process, StatefulProcess } from "../process/process"

const processTypes = {
  creep: {
    scout: "c.scout"
  }
}

export class ProcessRestorer {
  public static createStatelessProcess(processType: string, processId: ProcessId): Process | null {
    switch (processType) {
    default:
      return null
    }
  }

  public static createStatefullProcess(processType: string, processId: ProcessId, state: unknown): StatefulProcess | null {
    switch (processType) {
    case processTypes.creep.scout: {
      const restoredState = ScoutCreepProcess.parseState(state)
      if (restoredState == null) {
        return null
      }
      return new ScoutCreepProcess(processId, restoredState.creepId)
    }
    default:
      return null
    }
  }

  public static processTypeOf(instance: Process): string | null {
    if (instance instanceof ScoutCreepProcess) {
      return processTypes.creep.scout
    }
    return null
  }
}
