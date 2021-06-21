import { ScoutCreepProcess } from "../process/one_time_process/scout_creep"
import { ProcessId, Process, StatefulProcess } from "../process/process"

const processTypes = {
  creep: {
    scout: "c.scout"
  }
}

// - [ ] infrastructure以下に入れる
export class ProcessRestorer {
  public static createStatelessProcess(processType: string, processId: ProcessId): Process | null {
    switch (processType) {
    default:
      return null
    }
  }

  public static createStatefullProcess(processType: string, launchTime: number, processId: ProcessId, state: unknown): StatefulProcess | null {
    switch (processType) {
    case processTypes.creep.scout: {
      const restoredState = ScoutCreepProcess.parseState(state)
      if (restoredState == null) {
        return null
      }
      return new ScoutCreepProcess(launchTime, processId, restoredState.creepId, restoredState.routes)
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
