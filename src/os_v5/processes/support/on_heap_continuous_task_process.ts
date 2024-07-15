import { AnyProcessId, Process, ProcessDependencies, ProcessId } from "os_v5/process/process"
import type { Timestamp } from "shared/utility/timestamp"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { SystemCalls } from "os_v5/system_calls/interface"
import { NotificationReceiver } from "os_v5/system_calls/depended_system_calls/notification_manager"
import { Notification } from "os_v5/system_calls/depended_system_calls/notification_manager_types"
import { ProcessManagerProcessDidKillNotification, processManagerProcessDidKillNotification } from "os_v5/system_calls/process_manager/process_manager_notification"
import { coloredProcessType } from "os_v5/process/process_type_map"


type OnHeapContinuousTaskProcessState = {
  readonly id: string       /// Process identifier
  readonly l: AnyProcessId | "system"  /// Launcher process ID
  readonly u: Timestamp     /// Until
}

ProcessDecoder.register("OnHeapContinuousTaskProcess", (processId: OnHeapContinuousTaskProcessId, state: OnHeapContinuousTaskProcessState) => OnHeapContinuousTaskProcess.decode(processId, state))

export type OnHeapContinuousTaskProcessId = ProcessId<void, string, void, OnHeapContinuousTaskProcessState, OnHeapContinuousTaskProcess>


export class OnHeapContinuousTaskProcess extends Process<void, string, void, OnHeapContinuousTaskProcessState, OnHeapContinuousTaskProcess> implements NotificationReceiver {
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: OnHeapContinuousTaskProcessId,
    public readonly identifier: string,
    private readonly launcherProcessId: AnyProcessId | "system",
    private readonly until: Timestamp,
    private readonly task: () => void,
  ) {
    super()

    SystemCalls.notificationManager.addObserver(this, processManagerProcessDidKillNotification)
  }

  public encode(): OnHeapContinuousTaskProcessState {
    return {
      id: this.identifier,
      l: this.launcherProcessId,
      u: this.until,
    }
  }

  /** @throws */
  public static decode(processId: OnHeapContinuousTaskProcessId, state: OnHeapContinuousTaskProcessState): OnHeapContinuousTaskProcess {
    const ticksLeft = state.u - Game.time
    throw new Error(`(${processId}) ${coloredProcessType("OnHeapContinuousTaskProcess")}[${state.id}] Stopped task launched by ${state.l} (${ticksLeft} ticks left)`)
  }

  public static create(processId: OnHeapContinuousTaskProcessId, identifier: string, launcherProcessId: AnyProcessId | "system", duration: Timestamp, task: () => void): OnHeapContinuousTaskProcess {
    return new OnHeapContinuousTaskProcess(processId, identifier, launcherProcessId, Game.time + duration, task)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return `launched by ${this.launcherProcessId}, ${this.until - Game.time} ticks left`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
    if (Game.time > this.until) {
      SystemCalls.logger.log(this, `Finished task launched by ${this.launcherProcessId}`)
      SystemCalls.processManager.killProcess(this)
      return
    }

    this.task()
  }


  // ---- Event Receiver ---- //
  public didReceiveNotification(notification: Notification): void {
    switch (notification.eventName) {
    case processManagerProcessDidKillNotification:
      this.didReceiveProcessKilledNotification(notification as ProcessManagerProcessDidKillNotification)
    }
  }

  private didReceiveProcessKilledNotification(notification: ProcessManagerProcessDidKillNotification): void {
    if (this.launcherProcessId === "system") {
      return
    }
    if (notification.killedProcessId !== this.launcherProcessId) {
      return
    }
    SystemCalls.logger.log(this, `Launched process ${this.launcherProcessId} was killed`)
    SystemCalls.processManager.killProcess(this)
  }
}
