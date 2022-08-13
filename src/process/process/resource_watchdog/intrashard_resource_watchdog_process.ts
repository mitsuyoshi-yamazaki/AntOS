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

ProcessDecoder.register("IntrashardResourceWatchdogProcess", state => {
  return IntrashardResourceWatchdogProcess.decode(state as IntrashardResourceWatchdogProcessState)
})

/// heap上に置かれるログ
type ActivityLog = {
  readonly cpuUse: number[]
}

export interface IntrashardResourceWatchdogProcessState extends ProcessState {
  readonly intrashardResourceWatchDogState: IntrashardResourceWatchdogState
}

export class IntrashardResourceWatchdogProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly activityLog: ActivityLog

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly intrashardResourceWatchDog: IntrashardResourceWatchdog
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
    }
  }

  public static decode(state: IntrashardResourceWatchdogProcessState): IntrashardResourceWatchdogProcess {
    return new IntrashardResourceWatchdogProcess(
      state.l,
      state.i,
      IntrashardResourceWatchdog.decode(state.intrashardResourceWatchDogState),
    )
  }

  public static create(processId: ProcessId): IntrashardResourceWatchdogProcess {
    return new IntrashardResourceWatchdogProcess(
      Game.time,
      processId,
      IntrashardResourceWatchdog.create(),
    )
  }

  public processShortDescription(): string {
    return "" // TODO:
  }

  public runOnTick(): void {
    const cpu = Game.cpu.getUsed()
    // TODO:

    this.recordLogs(cpu)
  }

  private recordLogs(cpuUse: number): void {
    this.activityLog.cpuUse.push(cpuUse)

    const cpuLogLength = 20
    const cpuLogTrimLength = this.activityLog.cpuUse.length - cpuLogLength
    if (cpuLogTrimLength > 0) {
      this.activityLog.cpuUse.splice(0, cpuLogTrimLength)
    }
  }
}
