import { AnySerializable } from "os_v5/utility/types"
import { SystemCall } from "../system_call"
import { Logger } from "./logger"
import { ProcessManager } from "./process_manager/process_manager"
import { Environment } from "./environment"
import { UniqueId } from "./unique_id"
import { NotificationManager } from "./depended_system_calls/notification_manager"
import { UniqueName } from "./game_system_calls/unique_name"
import { StartupLauncher } from "./process_manager/startup_launcher"
import { DeferredTaskManager } from "./depended_system_calls/deferred_task_manager"
import { ScheduledStaticTaskManager } from "./depended_system_calls/scheduled_static_task_manager"

class SystemCallList {
  // Primitive
  readonly logger = Logger
  readonly environment = Environment
  readonly uniqueId = UniqueId

  // Depended
  readonly deferredTaskManager = DeferredTaskManager
  readonly scheduledStaticTaskManager = ScheduledStaticTaskManager
  readonly notificationManager = NotificationManager

  // Game SystemCall
  readonly uniqueName = UniqueName

  // Process
  // ProcessManagerがProcessを復元する前にStartupLauncher以外のSystemCallは初期化されている必要がある
  readonly processManager = ProcessManager

  // Application
  readonly startupLauncher = StartupLauncher
}

const systemCallList = new SystemCallList()


type SystemCallLifecycleFields = keyof SystemCall<string, AnySerializable>
export const SystemCalls: { [Key in keyof SystemCallList]: Omit<SystemCallList[Key], SystemCallLifecycleFields> } = systemCallList

export const systemCallLifecycles: SystemCall<string, AnySerializable>[] = Array.from(Object.values(systemCallList))
