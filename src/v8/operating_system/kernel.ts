import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Driver } from "./driver"
import { ProcessScheduler, ProcessSchedulerMemory } from "./process_scheduler"
import { standardInput } from "./system_call/standard_input"
import { StandardInputCommand } from "./system_call/standard_input_command"
import { LaunchCommand } from "./system_call/standard_input_command/launch_command"

export type KernelMemory = {
  process: ProcessSchedulerMemory
}

type LifecycleEventLoad = "load"
type LifecycleEventStartOfTick = "start_of_tick"
type LifecycleEventEndOfTick = "end_of_tick"
export type LifecycleEvent = LifecycleEventLoad | LifecycleEventStartOfTick | LifecycleEventEndOfTick
export const LifecycleEvent = {
  LifecycleEventLoad: "load" as LifecycleEventLoad,
  LifecycleEventStartOfTick: "start_of_tick" as LifecycleEventStartOfTick,
  LifecycleEventEndOfTick: "end_of_tick" as LifecycleEventEndOfTick,
}

const kernelConstants = {
  driverMaxLoadCpu: 10,
}

interface KernelInterface {
  registerDriverCall(events: LifecycleEvent[], driver: Driver): void

  run(memory: KernelMemory): void
}

type DriverEventCall = () => void

export class Kernel implements KernelInterface {
  private readonly processScheduler: ProcessScheduler
  private lastCpuUse: number | null = null
  private readonly standardInputCommands: StandardInputCommand[]

  private readonly driverCalls: { [K in LifecycleEvent]: DriverEventCall[] } = {
    load: [],
    start_of_tick: [],
    end_of_tick: [],
  }

  public constructor(
    memory: KernelMemory,
  ) {
    this.processScheduler = new ProcessScheduler(memory.process)
    this.standardInputCommands = [
      new LaunchCommand(this.processScheduler.launchWithArguments),
    ]
  }

  public registerDriverCall(events: LifecycleEvent[], driver: Driver): void {
    const register = (call: DriverEventCall | undefined, list: DriverEventCall[], description: string, reversed?: boolean): void => {
      if (call == null) {
        PrimitiveLogger.fatal(`${description} not implemented`)
        return
      }
      if (reversed === true) {
        list.unshift(call)
      } else {
        list.push(call)
      }
    }

    events.forEach(event => {
      const description = `${driver.description}.${event}`
      switch (event) {
      case LifecycleEvent.LifecycleEventLoad:
        register(driver.load, this.driverCalls.load, description)
        break
      case LifecycleEvent.LifecycleEventStartOfTick:
        register(driver.startOfTick, this.driverCalls.start_of_tick, description)
        break
      case LifecycleEvent.LifecycleEventEndOfTick:
        register(driver.endOfTick, this.driverCalls.end_of_tick, description, true)
        break
      }
    })
  }

  public run(memory: KernelMemory): void {
    this.systemCallStartOfTick()

    if (this.driverCalls.load.length > 0) {
      this.loadDrivers()
    }

    this.driverCalls.start_of_tick.forEach(call => {
      ErrorMapper.wrapLoop((): void => {
        call()
      })()
    })

    if (Game.time % 100 === 0) {
      PrimitiveLogger.log("v8 kernel.run()")  // FixMe: 消す
    }

    this.processScheduler.run(this.lastCpuUse)

    this.driverCalls.end_of_tick.forEach(call => {
      ErrorMapper.wrapLoop((): void => {
        call()
      })()
    })

    this.lastCpuUse = Game.cpu.getUsed()
  }

  private loadDrivers(): void {
    const maxCpu = 10
    const cpu = kernelConstants.driverMaxLoadCpu

    for (const load of this.driverCalls.load) {
      ErrorMapper.wrapLoop((): void => {
        load()
      })
      if (Game.cpu.getUsed() - cpu > maxCpu) {
        break
      }
    }
  }

  private systemCallStartOfTick(): void {
    ErrorMapper.wrapLoop((): void => {
      Game.v8 = standardInput(this.standardInputCommands)
    })
  }
}
