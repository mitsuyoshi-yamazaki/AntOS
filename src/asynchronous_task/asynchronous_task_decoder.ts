import { ErrorMapper } from "error_mapper/ErrorMapper"
import { AsynchronousTask, AsynchronousTaskState } from "./asynchronous_task"
import { TestAsynchronousTask, TestAsynchronousTaskState } from "./task/test_task"

export type AsynchronousTaskTypeIdentifier = keyof AsynchronousTaskTypes
class AsynchronousTaskTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "TestAsynchronousTask" = (state: AsynchronousTaskState) => TestAsynchronousTask.decode(state as unknown as TestAsynchronousTaskState)
}

export function decodeAsynchronousTaskFrom(state: AsynchronousTaskState): AsynchronousTask | null {
  let decoded: AsynchronousTask | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new AsynchronousTaskTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeProcessFrom(), process type: ${state.t}`)()
  return decoded
}
