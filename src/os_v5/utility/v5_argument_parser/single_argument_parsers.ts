import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { getKeyDescription, SingleOptionalArgument } from "../argument_parser/single_argument_parser"
import { AnyV5Creep, AnyV5CreepMemory, isV5Creep } from "../game_object/creep"


export class ProcessArgument extends SingleOptionalArgument<void, AnyProcess> {
  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): AnyProcess {
    if (this.value == null || this.value.length <= 0) {
      throw this.missingArgumentErrorMessage()
    }

    const process = ProcessManager.getProcess(this.value as AnyProcessId)
    if (process == null) {
      throw `No process with ID ${this.value} (${getKeyDescription(this.key)})`
    }

    return process
  }
}


// ---- Game Object ---- //
export class V5CreepArgument extends SingleOptionalArgument<{processId?: AnyProcessId}, AnyV5Creep> {
  /** throws */
  public parse(options?: { processId?: AnyProcessId }): AnyV5Creep {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const creep = Game.creeps[this.value]
    if (creep == null) {
      throw `No my creep named ${this.value}`
    }
    if (!isV5Creep(creep)) {
      throw `Creep ${creep.name} is not initialized for v5`
    }

    if (options?.processId != null) {
      const creepMemory: AnyV5CreepMemory = creep.memory
      if (creepMemory.p !== options.processId) {
        throw `Creep ${creep.name} does not belong to process ${options.processId}`
      }
    }

    return creep
  }
}
