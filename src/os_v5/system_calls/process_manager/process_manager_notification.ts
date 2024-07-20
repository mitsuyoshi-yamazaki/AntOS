import { AnyProcessId } from "os_v5/process/process"
import { Notification } from "../depended_system_calls/notification_manager_types"

export const processManagerProcessDidLaunchNotification = "pm_process_launched"
export const processManagerProcessDidKillNotification = "pm_process_killed"

export type ProcessManagerProcessDidLaunchNotification = Notification & {
  readonly eventName: "pm_process_launched"
  readonly launchedProcessId: AnyProcessId
}
export type ProcessManagerProcessDidKillNotification = Notification & {
  readonly eventName: "pm_process_killed"
  readonly killedProcessId: AnyProcessId
}
export type ProcessManagerNotification = ProcessManagerProcessDidLaunchNotification | ProcessManagerProcessDidKillNotification
