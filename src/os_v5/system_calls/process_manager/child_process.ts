import { AnyProcess, AnyProcessId } from "os_v5/process/process"

/**
# ChildProcess
## 概要
- 子Processの参照を司る非Process処理

### 目的
- 親Processからの司令を子Processの処理前に行う
  - Dependencyで実現すると子Processがそのtickで行った処理を上書きする形になる
- ProcessManagerが司るProcessのlifecycleとTypeScriptオブジェクトのlifecycleの不一致を解消する

### 補足
- 子Processの参照を持つ場合、ProcessにはOS側の制約があるため、Processインスタンスの参照を保持していても利用できない/すべきではない場合がある
  - 一方で必ず子Processを持つ場合はTypeScriptとして参照を保持したい

## 要望
- ChildProcessの必要性は、通常のDependencyでは一方方向の依存しか実現できないため

## 制約
- Processの起動時 or Memoryからの復元時は、まだProcessManagerの管理下にないため、自身に依存する子Processは起動できない
  - 一方でTypeScriptとして参照を保持したいという要望を満たすため、起動時 or 復元時には子ProcessのProcessID or launcherのみ保持するChildProcessを作成しておき、ChildProcessはProcessManagerが起動してからそれらをProcessに起こすようにする
- 子Processは手動で停止 or 依存ライブラリの停止や不具合により停止しうる
 */


// TODO: Process停止時の通知
// TODO: 親が終了する際にChildProcessのインスタンスが残らないようにする
// ProcessManagerにdecode時にChildProcessを返せるようにする・ChildProcessを途中で追加できるようにする
// shard3で検証
// Game.v5.io("message 28 spawn count=1 body=1m room_name=E32N51")
// Game.v5.io("message 28 creep j83 move_to_shard shard3 portal_room_name=E30N50 waypoints=E32N50")


type ProcessSpecifierId = {
  readonly case: "id"
  readonly id: AnyProcessId
}
type ProcessSpecifierLauncher<P extends AnyProcess> = {
  readonly case: "launcher"
  readonly launcher: (processId: AnyProcessId) => P
}
type ProcessSpecifier<P extends AnyProcess> = ProcessSpecifierId | ProcessSpecifierLauncher<P>


type ProcessContainerUninitialized<P extends AnyProcess> = {
  readonly case: "uninitialized"
  readonly specifier: ProcessSpecifier<P>
}
type ProcessContainerAvailable<P extends AnyProcess> = {
  readonly case: "available"
  readonly process: P
}
type ProcessContainerUnavailable = {
  readonly case: "unavailable"
  readonly reason: "inexisting" | "suspended" | "killed" | "program_error"
  readonly detail: string
}
type ProcessContainer<P extends AnyProcess> = ProcessContainerUninitialized<P> | ProcessContainerAvailable<P> | ProcessContainerUnavailable


export class ChildProcess<P extends AnyProcess> {
  /// 最初にアクセスされたタイミング（loadが終わってrunのタイミング）でProcessManagerからProcessを取得する
  public get process(): P | null {
    switch (this.processContainer.case) {
    case "uninitialized": {
      const container = this.initializeProcess(this.processContainer.specifier)
      this.processContainer = container
      switch (container.case) {
      case "available":
        return container.process
      case "unavailable":
        return null
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = container
        return null
      }
      }
    }
    case "available":
      return this.processContainer.process
    case "unavailable":
      return null
    }
  }
  private processContainer: ProcessContainer<P>

  private constructor(
    specifier: ProcessSpecifier<P>,
  ) {
    this.processContainer = {
      case: "uninitialized",
      specifier,
    }
  }

  public static createByProcessId<P extends AnyProcess>(processId: AnyProcessId): ChildProcess<P> {
    return new ChildProcess<P>({
      case: "id",
      id: processId,
    })
  }

  public static createByProcess<P extends AnyProcess>(launcher: (processId: AnyProcessId) => P): ChildProcess<P> {
    return new ChildProcess<P>({
      case: "launcher",
      launcher,
    })
  }


  // ---- Private ---- //
  private initializeProcess(specifier: ProcessSpecifier<P>): ProcessContainerAvailable<P> | ProcessContainerUnavailable {
    const container = ((): ProcessContainerAvailable<P> | ProcessContainerUnavailable => {
      switch (specifier.case) {
      case "id":
        return this.initializeProcessById(specifier.id)
      case "launcher":
        return this.initializeProcessByLauncher(specifier.launcher)
      }
    })()

    if (container.case !== "available") {
      return container
    }

    return container
  }

  private initializeProcessById(processId: AnyProcessId): ProcessContainerAvailable<P> | ProcessContainerUnavailable {
    const process = SystemCalls.processManager.getProcess(processId)
    if (process == null) {
      return {
        case: "unavailable",
        reason: "inexisting",
        detail: "no such process",
      }
    }
    return {
      case: "available",
      process: process as P,
    }
  }

  private initializeProcessByLauncher(launcher: (processId: AnyProcessId) => P): ProcessContainerAvailable<P> | ProcessContainerUnavailable {
    try {
      const process = SystemCalls.processManager.addProcess(processId => launcher(processId as AnyProcessId))
      return {
        case: "available",
        process: process as P,
      }
    } catch (error) {
      return {
        case: "unavailable",
        reason: "program_error",
        detail: `${error}`,
      }
    }
  }
}
