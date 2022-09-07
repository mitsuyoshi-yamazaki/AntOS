import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"

export type MessageObserver = {
  /** @throws */
  didReceiveMessage(message: ArgumentParser): string
}

export const isMessageObserver = (arg: unknown): arg is MessageObserver => {
  if ((arg as MessageObserver).didReceiveMessage == null) {
    return false
  }
  return true
}
