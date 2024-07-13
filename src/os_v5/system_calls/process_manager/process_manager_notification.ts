import { AnyProcessId } from "os_v5/process/process"
import { Notification } from "../depended_system_calls/notification_center_types"

export const processManagerProcessDidLaunchNotification = "pm_process_launched"
export const processManagerProcessDidKillNotification = "pm_process_killed"

export type ProcessManagerProcessDidLaunchNotification = {
  readonly launchedProcessId: AnyProcessId
}
export type ProcessManagerProcessDidKillNotification = {
  readonly killedProcessId: AnyProcessId
}
export type ProcessManagerNotification = Notification & (ProcessManagerProcessDidLaunchNotification | ProcessManagerProcessDidKillNotification)
