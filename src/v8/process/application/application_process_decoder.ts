import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText } from "utility/log"
import { ProcessState } from "../process"
import { ProcessType, ProcessTypeConverter } from "../process_type"
import { ApplicationProcess } from "./application_process"

type Decoder = (state: ProcessState) => ApplicationProcess | null

const decoders = new Map<ProcessType, Decoder>()
const undecodableProcessTypes: ProcessType[] = []

export const ApplicationProcessDecoder = {
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

  decode(state: ProcessState): ApplicationProcess | null {
    return ErrorMapper.wrapLoop((): ApplicationProcess | null => {
      const processType = ProcessTypeConverter.revert(state.t)
      if (undecodableProcessTypes.includes(processType) === true) {
        PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} ignored undecodable process ${processType} (${state.t})`)
        return null
      }

      const decoder = decoders.get(processType)
      if (decoder == null) {
        PrimitiveLogger.programError(`ProcessDecoder unregistered process ${processType} (${state.t})`)
        return null
      }
      return decoder(state)
    })()
  },
}
