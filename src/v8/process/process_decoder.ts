import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText } from "utility/log"
import { Process, ProcessState } from "./process"

type Decoder = (state: ProcessState) => Process | null

const decoders = new Map<string, Decoder>()
const undecodableProcessTypes: string[] = []

export const ProcessDecoder = {
  register(processType: string, decoder: Decoder): void {
    if (decoders.has(processType) === true) {
      PrimitiveLogger.fatal(`ProcessDecoder registering ${processType} twice ${Game.time}`)
      return
    }
    decoders.set(processType, decoder)
  },

  registerUndecodableProcess(processType: string): void {
    if (undecodableProcessTypes.includes(processType) === true) {
      PrimitiveLogger.fatal(`ProcessDecoder registering undecodable process ${processType} twice ${Game.time}`)
      return
    }
    undecodableProcessTypes.push(processType)
  },

  decode(state: ProcessState): Process | null {
    return ErrorMapper.wrapLoop((): Process | null => {
      if (undecodableProcessTypes.includes(state.t) === true) {
        PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} ignored undecodable process ${state.t}`)
        return null
      }

      const decoder = decoders.get(state.t)
      if (decoder == null) {
        PrimitiveLogger.programError(`ProcessDecoder unregistered process ${state.t}`)
        return null
      }
      return decoder(state)
    })()
  },
}
