import { ProcessId } from "process/process"
import { ValuedArrayMap } from "shared/utility/valued_collection"

type ProcessLogRequest = {
  readonly processId: ProcessId
  readonly processType: string
  readonly message: string
}

const processLogRequests = new ValuedArrayMap<ProcessId, ProcessLogRequest>()

export const ProcessRequestStore = {
  beforeTick(): void {
    processLogRequests.clear()
  },

  afterTick(): void {
  },

  addLogRequest(logRequest: ProcessLogRequest): void {
    processLogRequests.getValueFor(logRequest.processId).push(logRequest)
  },

  logRequests(): Map<ProcessId, ProcessLogRequest[]> {
    return new Map(processLogRequests)
  },
}
