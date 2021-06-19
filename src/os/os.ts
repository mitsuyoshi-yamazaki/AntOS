import { Process, ProcessId } from "./process"

export interface SystemInformation {
}

/**
 * - tickで途切れるインスタンスのライフサイクルがあたかも途切れていないかのように実装できるようにする
 *   - 状態の永続化
 *     - [ ] Processは永続化したい情報をOSへ渡す
 * - イベントの検出と通知
 *   - 子プロセスには一部のGame APIの呼び出しを制限する
 * - プロセスの親子関係
 *   - 親の情報をstoreすれば良いようにする
 */
export class OperatingSystem {
  private processIndex = 0
  private readonly processes = new Map<ProcessId, Process>()

  public constructor(
    public readonly systemInformation: SystemInformation,
  ) {
    this.wakeUp()
  }

  // ---- Process ---- //
  public createChildProcess<T extends Process>(parent: Process, maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    this.processes.set(processId, process)
    return process
  }

  public addProcess<T extends Process>(maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    this.processes.set(processId, process)
    return process
  }

  public processOf(processId: ProcessId): Process | undefined {
    return this.processes.get(processId)
  }

  public suspendProcess(processId: ProcessId): void {
    // TODO:
  }

  public resumeProcess(processId: ProcessId): void {
    // TODO:
  }

  public killProcess(processId: ProcessId): void {
    // TODO:
  }

  // ---- Run ---- //
  public run(): void {
    // TODO:
  }

  // ---- Private ---- //
  private wakeUp(): void {
    this.restoreProcesses()
  }

  private restoreProcesses(): void {
    // TODO:
  }

  private getNewProcessId(): ProcessId {
    const processId = Game.time * 1000 + this.processIndex
    this.processIndex += 1
    return processId
  }
}
