import { Process, ProcessState } from "../process"
import { ProcessDecoder } from "../process_decoder"
import { ProcessTypeConverter } from "../process_type"

const processType = "EconomyProcess"
ProcessDecoder.register(ProcessTypeConverter.convert(processType), state => EconomyProcess.decode(state as EconomyProcessState))

export interface EconomyProcessState extends ProcessState {
}

export class EconomyProcess extends Process {
  public readonly processType = processType

  private constructor(
  ) {
    super()
  }

  public encode(): EconomyProcessState {
    return {
      t: ProcessTypeConverter.convert(this.processType),
    }
  }

  public static decode(state: EconomyProcessState): EconomyProcess {
    return new EconomyProcess()
  }

  public static create(): EconomyProcess {
    return new EconomyProcess()
  }

  public shortDescription = (): string => {
    return this.constructor.name
  }

  public run = (): void => {
    if (Game.time % 10 === 0) {
      console.log(`${this.constructor.name} ${this.processId}`)
    }
  }
}
