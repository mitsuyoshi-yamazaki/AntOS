import { MessageObserver, isMessageObserver } from "../../../src/os/infrastructure/message_observer"

test("isMessageObserver", () => {
  class SomeObject { }

  class MessageObserverObject implements MessageObserver {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public didReceiveMessage(message: unknown): string {
      return "ok"
    }
  }

  expect(isMessageObserver(new MessageObserverObject())).toBe(true)
  expect(isMessageObserver(new SomeObject())).toBe(false)
})
