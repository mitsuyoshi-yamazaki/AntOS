export type Notification = {
  readonly eventName: string
}

export const notificationCenterTestNotification = "nc_test"
export type NotificationCenterTestNotification = Notification & {
  readonly eventName: "nc_test"
  readonly message: string
}
