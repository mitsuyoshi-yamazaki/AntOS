import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText } from "utility/log"
import { AnyProcess } from "./any_process"
import { ProcessState } from "./process"
import { ProcessType, ProcessTypeConverter } from "./process_type"

import { V8TestProcess, V8TestProcessState } from "./temporary/v8_test_process"

type Decoder = (state: ProcessState) => AnyProcess | null

const decoders = new Map<ProcessType, Decoder>()
const undecodableProcessTypes: ProcessType[] = []

export const ProcessDecoder = {
  register(processType: ProcessType, decoder: Decoder): void {
    if (decoders.has(processType) === true) {
      PrimitiveLogger.fatal(`ProcessDecoder registering ${processType} twice ${Game.time}`)
      return
    }
    decoders.set(processType, decoder)
  },

  registerUndecodableProcess(processType: ProcessType): void {
    if (undecodableProcessTypes.includes(processType) === true) {
      PrimitiveLogger.fatal(`ProcessDecoder registering undecodable process ${processType} twice ${Game.time}`)
      return
    }
    undecodableProcessTypes.push(processType)
  },

  decode(state: ProcessState): AnyProcess | null {
    const processType = ProcessTypeConverter.revert(state.t)
    if (undecodableProcessTypes.includes(processType) === true) {
      PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} ignored undecodable process ${state.t} (${processType})`)
      return null
    }

    const decoder = decoders.get(processType)
    if (decoder == null) {
      PrimitiveLogger.programError(`ProcessDecoder unregistered process ${state.t} (${processType})`)
      return null
    }
    return ErrorMapper.wrapLoop(() => decoder(state))()
  },
}

ProcessDecoder.register("V8TestProcess", state => {
  return V8TestProcess.decode(state as V8TestProcessState)
})
