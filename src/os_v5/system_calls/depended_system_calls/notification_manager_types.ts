export type Notification = {
  readonly eventName: string
}

export const notificationManagerTestNotification = "nm_test"
export type NotificationManagerTestNotification = Notification & {
  readonly eventName: "nm_test"
  readonly message: string
}
