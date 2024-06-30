
export const taskErrorHandlers = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  none: <T>(_: T): "error" => "error"
}

export type TaskErrorHandlerTypes = keyof typeof taskErrorHandlers
