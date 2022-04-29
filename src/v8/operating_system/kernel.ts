import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Driver } from "./driver"

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

  run(): void
}

type DriverEventCall = () => void
const driverCalls: { [K in LifecycleEvent]: DriverEventCall[] } = {
  load: [],
  start_of_tick: [],
  end_of_tick: [],
}

export const Kernel: KernelInterface = {
  registerDriverCall(events: LifecycleEvent[], driver: Driver): void {
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
        register(driver.load, driverCalls.load, description)
        break
      case LifecycleEvent.LifecycleEventStartOfTick:
        register(driver.startOfTick, driverCalls.start_of_tick, description)
        break
      case LifecycleEvent.LifecycleEventEndOfTick:
        register(driver.endOfTick, driverCalls.end_of_tick, description, true)
        break
      }
    })
  },

  run(): void {
    if (driverCalls.load.length > 0) {
      loadDrivers()
    }

    driverCalls.start_of_tick.forEach(call => {
      ErrorMapper.wrapLoop((): void => {
        call()
      })()
    })

    if (Game.time % 100 === 0) {
      PrimitiveLogger.log("v8 kernel.run()")
    }

    driverCalls.end_of_tick.forEach(call => {
      ErrorMapper.wrapLoop((): void => {
        call()
      })()
    })
  },
}

const loadDrivers = (): void => {
  const maxCpu = 10
  const cpu = kernelConstants.driverMaxLoadCpu

  for (const load of driverCalls.load) {
    load()
    if (Game.cpu.getUsed() - cpu > maxCpu) {
      break
    }
  }
}
