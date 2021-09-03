import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { processLog } from "os/infrastructure/logger"
import { ProcessState } from "process/process_state"

export interface TestProcessState extends ProcessState {
  testMemory: string | null
}

export class TestProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly testMemory: string | null,
  ) {}

  public encode(): TestProcessState {
    return {
      t: "TestProcess",
      l: this.launchTime,
      i: this.processId,
      testMemory: this.testMemory,
    }
  }

  public static decode(state: TestProcessState): TestProcess {
    return new TestProcess(state.l, state.i, state.testMemory)
  }

  public static create(processId: ProcessId): TestProcess {
    return new TestProcess(Game.time, processId, null)
  }

  public processDescription(): string {
    return `Test process at ${Game.time}`
  }

  public runOnTick(): void {
    // const creep = Game.creeps["baked_tart_1346405c"]
    // if (creep != null && creep.room.controller != null && (creep.room.controller.sign == null || creep.room.controller.sign.username !== Game.user.name)) {
    //   creep.v5task = null
    //   if (creep.signController(creep.room.controller, Sign.signForOwnedRoom()) === ERR_NOT_IN_RANGE) {
    //     creep.moveTo(creep.room.controller)
    //   }
    // }

    processLog(this, `Test log at ${Math.floor(Game.time / 20) * 20}, ${this.testMemory}`)
  }
}
