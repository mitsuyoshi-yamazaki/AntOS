import { SerializableObject } from "os_v5/utility/types"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { AnyProcess, AnyProcessId, Process, ProcessId } from "../../process/process"
import { ProcessTypes, SerializedProcessTypes } from "../../process/process_type_map"

type Decoder<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>> = (processId: ProcessId<D, I, M, S, P>, state: S) => P
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDecoder = Decoder<any, any, any, any, AnyProcess>
const decoders = new Map<string, AnyDecoder>()


export type ProcessState = SerializableObject & {
  readonly t: SerializedProcessTypes
  readonly i: AnyProcessId
}


export const ProcessDecoder = {
  register<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: ProcessTypes, decoder: Decoder<D, I, M, S, P>): void {
    if (decoders.has(processType) === true) {
      PrimitiveLogger.programError(`ProcessDecoder registering ${processType} twice ${Game.time}`)
      return
    }
    decoders.set(processType, decoder as unknown as AnyDecoder)
  },

  decode<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: ProcessTypes, processId: ProcessId<D, I, M, S, P>, state: S): P | null {
    const decoder = decoders.get(processType)
    if (decoder == null) {
      PrimitiveLogger.programError(`ProcessDecoder unregistered process ${processType}`)
      return null
    }
    return decoder(processId, state) as P
  },
}
