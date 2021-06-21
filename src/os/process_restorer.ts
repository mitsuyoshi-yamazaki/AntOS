import { LaunchRoomProcess } from "process/one_time_process/launch_room"
import { ScoutCreepProcess } from "../process/one_time_process/scout_creep"
import { ProcessId, Process, StatefulProcess } from "../process/process"

const processTypes = {
  onetime: {
    scoutCreep: "o.sc", // ScoutCreepProcess
    launchRoom: "o.lr", // LaunchRoomProcess
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
    case processTypes.onetime.scoutCreep: {
      const restoredState = ScoutCreepProcess.parseState(state)
      if (restoredState == null) {
        return null
      }
      return new ScoutCreepProcess(launchTime, processId, restoredState.creepId, restoredState.routes)
    }
    case processTypes.onetime.launchRoom: {
      const restoredState = LaunchRoomProcess.parseState(state)
      if (restoredState == null) {
        return null
      }
      return new LaunchRoomProcess(launchTime, processId, restoredState.r, restoredState.c, restoredState.w)
    }
    default:
      return null
    }
  }

  public static processTypeOf(instance: Process): string | null {
    if (instance instanceof ScoutCreepProcess) {
      return processTypes.onetime.scoutCreep
    }
    if (instance instanceof LaunchRoomProcess) {
      return processTypes.onetime.launchRoom
    }
    return null
  }
}
