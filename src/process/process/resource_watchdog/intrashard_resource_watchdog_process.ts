/**
 # 汎用問題解決器（の一案）
 ## 要件
 - 自動的な問題解決
 - 以下の人間の指示を理解すること
   - 抽象的指示
   - 保つべき状態/損なわれている状態の回復（とるべき行動ではなく

 ## 実装
 問題解決器は問題を抽象度順に並べて委譲する運用上、階層化構造をもつ
 この構造をv1系OSのProcessで実現することは困難なため、単一Process内に階層化した全問題を格納し実行する
 */

/**
 # IntrashardResourceWatchdogProcess
 ## 概要
 汎用問題解決器の実地試験実装用処理

 ## 要件

 ## 構造
 */

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { } from "./watchdog"
import { IntrashardResourceWatchdog, IntrashardResourceWatchdogState } from "./intrashard_resource_watchdog"
import { MessageObserver } from "os/infrastructure/message_observer"
import { OperatingSystem } from "os/os"
import { ProcessInfo } from "os/os_process_info"
import { IntershardResourceTransferProcess } from "process/onetime/intershard/intershard_resource_transfer_process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ValuedArrayMap } from "utility/valued_collection"

ProcessDecoder.register("IntrashardResourceWatchdogProcess", state => {
  return IntrashardResourceWatchdogProcess.decode(state as IntrashardResourceWatchdogProcessState)
})

/// heap上に置かれるログ
type ActivityLog = {
  readonly cpuUse: number[]
}

export interface IntrashardResourceWatchdogProcessState extends ProcessState {
  readonly intrashardResourceWatchDogState: IntrashardResourceWatchdogState
  readonly running: boolean
}

export class IntrashardResourceWatchdogProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private readonly activityLog: ActivityLog
  private interRoomResourceManagementProcessId: ProcessId | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly intrashardResourceWatchDog: IntrashardResourceWatchdog,
    private running: boolean,
  ) {
    this.taskIdentifier = this.constructor.name

    this.activityLog = {
      cpuUse: []
    }
  }

  public encode(): IntrashardResourceWatchdogProcessState {
    return {
      t: "IntrashardResourceWatchdogProcess",
      l: this.launchTime,
      i: this.processId,
      intrashardResourceWatchDogState: this.intrashardResourceWatchDog.encode(),
      running: this.running,
    }
  }

  public static decode(state: IntrashardResourceWatchdogProcessState): IntrashardResourceWatchdogProcess {
    return new IntrashardResourceWatchdogProcess(
      state.l,
      state.i,
      IntrashardResourceWatchdog.decode(state.intrashardResourceWatchDogState),
      state.running,
    )
  }

  public static create(processId: ProcessId): IntrashardResourceWatchdogProcess {
    return new IntrashardResourceWatchdogProcess(
      Game.time,
      processId,
      IntrashardResourceWatchdog.create(),
      false,
    )
  }

  public processShortDescription(): string {
    const description: string[] = []

    const runningState: string[] = [
      this.running === true ? "running" : "stopped",
    ]
    if (this.canRunWatchDog() === true) {
      runningState.push("(exclusive process running)")
    }

    description.push(runningState.join(""))

    return description.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "dry_run", "stop", "resume"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.showStatus()

      case "dry_run":
        return this.dryRun()

      case "resume":
        this.running = true
        if (this.canRunWatchDog() === false) {
          return "resumed"
        }
        return "resumed (still not running due to exclusive process)"

      case "stop":
        this.running = false
        return "ok"

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  private dryRun(): string {
    return this.intrashardResourceWatchDog.dryRun()
      .map(task => {
        switch (task.case) {
        case "send resource":
          return `- ${roomLink(task.from)} =&gt ${roomLink(task.to)} ${task.amount} ${coloredResourceType(task.resourceType)}`
        case "resolve action incomplete":
          return task.case // TODO:
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _: never = task
          return "never"
        }
        }
      })
      .join("\n")
  }

  private showStatus(): string {
    const status = this.intrashardResourceWatchDog.getCurrentState()
    const errors = new ValuedArrayMap<string, string>() // error name, room error description

    status.errors.forEach((roomErrors, roomName) => {
      roomErrors.forEach(error => {
        switch (error.case) {
        case "lack of terminal space":
          errors.getValueFor(error.case).push(`${roomLink(roomName)}, ${error.freeSpace}`)
          break
        case "lack of terminal energy space":
          errors.getValueFor(error.case).push(`${roomLink(roomName)}, ${error.energySpace - error.freeSpace}/${error.energySpace}`)
          break
        case "lack of energy":
          errors.getValueFor(error.case).push(`${roomLink(roomName)}, ${error.totalEnergyAmount}`)
          break
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _: never = error
          break
        }
        }
      })
    })

    const description: string[] = [
      `${status.roomCount} rooms total`,
      ...Array.from(errors.entries()).flatMap(([errorName, errorDescriptions]): string[] => {
        return [
          `${errorDescriptions.length} ${errorName}:`,
          ...errorDescriptions.map(errorDescription => `- ${errorDescription}`),
        ]
      }),
    ]

    return description.join("\n")
  }

  public runOnTick(): void {
    const cpu = Game.cpu.getUsed()

    if (this.running === true) {
      if (this.canRunWatchDog() === true) {
        this.intrashardResourceWatchDog.run()
      }
    }

    this.recordLogs(cpu)
  }

  // ---- Check Exclusive Processes ---- //
  private canRunWatchDog(): boolean {
    const exclusiveProcessInfo = ((): ProcessInfo | null => {
      if (this.interRoomResourceManagementProcessId != null) {
        const processInfo = OperatingSystem.os.processInfoOf(this.interRoomResourceManagementProcessId)
        if (processInfo != null) {
          return processInfo
        }
        this.interRoomResourceManagementProcessId = null
      }

      const processInfo = OperatingSystem.os.listAllProcesses().find(processInfo => {
        if (processInfo.process instanceof IntershardResourceTransferProcess) {
          return true
        }
        return false
      })
      if (processInfo != null) {
        this.interRoomResourceManagementProcessId = processInfo.processId
        return processInfo
      }
      return null
    })()

    if (exclusiveProcessInfo == null) {
      return true
    }
    if (exclusiveProcessInfo.running !== true) {
      return true
    }
    return false
  }

  // ---- Activity Logs ---- //
  private recordLogs(cpuUse: number): void {
    this.activityLog.cpuUse.push(cpuUse)

    const cpuLogLength = 20
    const cpuLogTrimLength = this.activityLog.cpuUse.length - cpuLogLength
    if (cpuLogTrimLength > 0) {
      this.activityLog.cpuUse.splice(0, cpuLogTrimLength)
    }
  }
}
