import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { AnyProcess, ProcessState } from "../../process/process"

type Decoder = (state: ProcessState) => AnyProcess | null
const decoders = new Map<string, Decoder>()


export const ProcessDecoder = {
  register(processType: string, decoder: Decoder): void {
    if (decoders.has(processType) === true) {
      PrimitiveLogger.programError(`ProcessDecoder registering ${processType} twice ${Game.time}`)
      return
    }
    decoders.set(processType, decoder)
  },

  decode(state: ProcessState): AnyProcess | null {
    const decoder = decoders.get(state.t)
    if (decoder == null) {
      PrimitiveLogger.programError(`ProcessDecoder unregistered process ${state.t}`)
      return null
    }
    return decoder(state)
  },
}
