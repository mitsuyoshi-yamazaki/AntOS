import { AsynchronousTask, AsynchronousTaskIdentifier, AsynchronousTaskState } from "asynchronous_task/asynchronous_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Timestamp } from "utility/timestamp"

export interface TestAsynchronousTaskState extends AsynchronousTaskState {
}

export class TestAsynchronousTask implements AsynchronousTask {
  private constructor(
    public readonly createdAt: Timestamp,
    public readonly taskIdentifier: AsynchronousTaskIdentifier,
  ) {

  }

  public encode(): TestAsynchronousTaskState {
    return {
      t: "TestAsynchronousTask",
      createdAt: this.createdAt,
      taskIdentifier: this.taskIdentifier,
    }
  }

  public static decode(state: TestAsynchronousTaskState): TestAsynchronousTask {
    return new TestAsynchronousTask(state.createdAt, state.taskIdentifier)
  }

  public static create(identifier: AsynchronousTaskIdentifier): TestAsynchronousTask {
    return new TestAsynchronousTask(Game.time, identifier)
  }

  public taskShortDescription?(): string {
    return "Test task"
  }

  public run(): void {
    PrimitiveLogger.log(`run ${this.taskIdentifier}`)
  }
}
