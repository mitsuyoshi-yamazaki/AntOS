import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process } from "./process"
import { ProcessState } from "./process_state"

type Decoder = (state: ProcessState) => Process | null

const decoders = new Map<string, Decoder>()

export const ProcessDecoder = {
  register(processType: string, decoder: Decoder): void {
    if (decoders.has(processType) === true) {
      PrimitiveLogger.fatal(`ProcessDecoder registering ${processType} twice ${Game.time}`)
    }
    decoders.set(processType, decoder)
  },

  decode(state: ProcessState): Process | null {
    const decoder = decoders.get(state.t)
    if (decoder == null) {
      PrimitiveLogger.programError(`ProcessDecoder unregistered process ${state.t}`)
      return null
    }
    return decoder(state)
  },
}
