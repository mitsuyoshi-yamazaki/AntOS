import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { strictEntries } from "shared/utility/strict_entries"
import { Timestamp } from "shared/utility/timestamp"
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../system_call"
import { ProcessManager } from "./process_manager/process_manager"

/**
# Logger
## 要件
- Memoryを消費しない
- consoleの流速を上げすぎない

## TODO
- Processがkillされたら無効化する
 */

type LoggerMemory = {
  enabledPeriod: {[T: Timestamp]: AnyProcessId[]}
}

const initializeMemory = (memory: LoggerMemory): LoggerMemory => {
  const mutableMemroy = memory as Mutable<LoggerMemory>

  if (mutableMemroy.enabledPeriod == null) {
    mutableMemroy.enabledPeriod = {}
  }

  return mutableMemroy
}


let timestampByProcessId: { [T: Timestamp]: AnyProcessId[] } = {}
const processIdsByTimestamp = new Map<AnyProcessId, Timestamp>()


type Logger = {
  setLogEnabledFor(processIds: AnyProcessId[], duration: Timestamp): void /// その期間の間 log() を出力する（その他のメソッドは即時通知される）
  setLogDisabled(processIds: AnyProcessId[]): void
  enabledProcesses(): {process: AnyProcess, duration: Timestamp}[]

  log(process: AnyProcess, message: string, shouldShow?: true): void
  notice(process: AnyProcess, message: string): void
  fatal(process: AnyProcess, message: string): void
  programError(process: AnyProcess, message: string): void
}

export const Logger: SystemCall<"Logger", LoggerMemory> & Logger = {
  name: "Logger",
  [Symbol.toStringTag]: "Logger",

  load(memory: LoggerMemory): void {
    const time = Game.time
    const loggerMemory = initializeMemory(memory)

    timestampByProcessId = loggerMemory.enabledPeriod
    const timestampsToDelete: Timestamp[] = []

    strictEntries(timestampByProcessId).forEach(([timestamp, processIds]) => {
      if (timestamp > time) {
        processIds.forEach(processId => {
          processIdsByTimestamp.set(processId, timestamp)
        })
      } else {
        timestampsToDelete.push(timestamp)
      }
    })

    timestampsToDelete.forEach(timestamp => {
      delete timestampByProcessId[timestamp]
    })
  },

  startOfTick(): void {
    const time = Game.time
    if (timestampByProcessId[time] != null) {
      timestampByProcessId[time]?.forEach(processId => {
        processIdsByTimestamp.delete(processId)
        logLogDisabled(processId)
      })
      delete timestampByProcessId[time]
    }
  },

  endOfTick(): LoggerMemory {
    return {
      enabledPeriod: timestampByProcessId,
    }
  },

  // Logger
  setLogEnabledFor(processIds: AnyProcessId[], duration: Timestamp): void {
    if (duration <= 0) {
      return
    }

    const untilTime = Game.time + duration
    const processIdsToAdd: AnyProcessId[] = []
    const processIdsToDelete: AnyProcessId[] = []

    processIds.forEach(processId => {
      const storedTimestamp = processIdsByTimestamp.get(processId)
      if (storedTimestamp == null) {
        processIdsToAdd.push(processId)
      } else {
        if (storedTimestamp < untilTime) {
          processIdsToAdd.push(processId)
          processIdsToDelete.push(processId)
        }
      }
    })

    this.setLogDisabled(processIdsToDelete)

    if (timestampByProcessId[untilTime] == null) {
      timestampByProcessId[untilTime] = [...processIdsToAdd]
    } else {
      timestampByProcessId[untilTime]?.push(...processIdsToAdd)
    }

    processIdsToAdd.forEach(processId => {
      processIdsByTimestamp.set(processId, untilTime)
    })
  },

  setLogDisabled(processIds: AnyProcessId[]): void {
    processIds.forEach(processId => {
      const timestamp = processIdsByTimestamp.get(processId)
      if (timestamp == null) {
        return
      }

      processIdsByTimestamp.delete(processId)
      const processIdList = timestampByProcessId[timestamp]
      if (processIdList == null) {
        return
      }

      const index = processIdList.indexOf(processId)
      if (index < 0) {
        return
      }
      processIdList.splice(index, 1)
    })
  },

  enabledProcesses(): { process: AnyProcess, duration: Timestamp }[] {
    const processes = Array.from(processIdsByTimestamp.entries()).flatMap(([processId, timestamp]): { process: AnyProcess, duration: Timestamp }[] => {
      const process = ProcessManager.getProcess(processId)
      if (process == null) {
        return []
      }
      return [{
        process,
        duration: timestamp - Game.time,
      }]
    })

    processes.sort((lhs, rhs) => lhs.duration - rhs.duration)
    return processes
  },

  // Log
  log(process: AnyProcess, message: string, shouldShow?: true): void {
    if (shouldShow === true) {
      PrimitiveLogger.log(`${process} ${message}`, "log")
      return
    }
    if (processIdsByTimestamp.has(process.processId) !== true) {
      return
    }
    PrimitiveLogger.log(`${process} ${message}`, "log")
  },

  notice(process: AnyProcess, message: string): void {
    PrimitiveLogger.notice(`${process} ${message}`)
  },

  /** ゲームの危機状態の通知 */
  fatal(process: AnyProcess, message: string): void {
    PrimitiveLogger.fatal(`${process} ${message}`)
  },

  /** プログラムの問題の通知 */
  programError(process: AnyProcess, message: string): void {
    PrimitiveLogger.programError(`${process} ${message}`)
  },
}


const logLogDisabled = (processId: AnyProcessId): void => {
  const process = ProcessManager.getProcess(processId)

  if (process != null) {
    PrimitiveLogger.log(`Logger: disable log for ${process}`)
  } else {
    PrimitiveLogger.log(`Logger: disable log for terminated process with ID ${processId}`)
  }
}
