/**
 # Process
 ## 概要
 動的に運用するために処理をまとめた単位

 ## 要件
 - 問題解決器はOSに組み込まず、まずはいちProcessとして実装する

 ## 仕様
 ### Process Lifecycle
 1. インスタンスが生成される
 2. ProcessSchedulerに登録される。この際ProcessIdが付与され、親Processの下に入る。親Processは必要に応じてインスタンスを保持する // ここでschedulerに対するアクセサを渡してもよいか
 3. ProcessSchedulerから階層の元から順に実行される。子Processの実行に引数が必要な場合、親の実行時に引数を与えたexecutableを子Process.run()と置き換える
 4. 停止処理を行うとたんに実行がスキップされる
 5. ProcessSchedulerの登録を解除するとProcessIdが破棄され、親Processからも剥がされる。インスタンスが生存していても実行されず、encodeもされない

 ---

 - 階層化される
   - 親子関係は
     - 親は任意に子を操作できる（任意のProcess間のメッセージングとは別）
     - 親は子の実行時に必須の引数を与えることができる
     - 実行時引数が不要なProcessのみ最上位（kernelが直接Memoryに保存する）になることができる
 - Processはkernel経由で共通のインターフェースでアクセスできる（人間もアクセスできる
   - kernelはProcess IDからProcessを引いてこれる必要がある（AnyProcess扱い
     - ↑これが親子関係の具象型Process扱いと干渉している
     - Kernelからkillされても親が保持し続けてしまう
       - ProcessInfo型で保持し、中身をMutableで操作できるのはkernelのみとする
         - →Process実行時に子Process一覧を渡せば良いのではないか
     - kernelがchildrenを渡すとchildrenの構造がparentに不明になる
       - ViewController hierarchyを参考にすると？→描画されないが親が持っている状態はありうる

 ### 案1
 - kernelはRootProcessのみをMemoryに保管する
 - 各親ProcessはデコードしたProcessをSchedularに渡す
 - この方法だと親がProcessの管理責任を持つ

 # Discussion
 - 子ProcessがKernelから見えるのであれば手動の操作と干渉する
   - 見えないのであればProcessのインターフェースを取る必要はない
   - メッセージは送れる必要がある
 */

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { State, Stateful } from "os/infrastructure/state"
import type { CompressedProcessType, ProcessType } from "./process_type"
import type { ProcessStateDescription } from "./process_state_description"

export type ProcessId = string

export interface ProcessState extends State {
  readonly t: CompressedProcessType
}

export interface Processss extends Stateful {
  readonly processId: ProcessId
  readonly processType: ProcessType

  encode(): ProcessState
}

export abstract class Process implements Stateful {
  public get processId(): ProcessId | null {
    return this._processId
  }
  private _processId: ProcessId | null = null // この辺りを変更する場合は外部から直接変更しているProcessSchedulerの内部実装も併せて変更すること

  public abstract readonly processType: ProcessType

  protected constructor(
  ) {
  }

  public abstract encode(): ProcessState

  // 子Processのデコード時に必要とされる自身の情報を引き渡すため
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public decodeChildProcess(processType: ProcessType, state: ProcessState): Process | null {
    PrimitiveLogger.programError(`${this.processId} ${this.constructor.name}.decodeChildProcesses() not implemented for ${processType}`)
    return null
  }

  /**
   * ProcessCommand経由で表示される説明
   * 実行に必須の引数がある場合はrun()内で置き換える
   */
  public shortDescription?: () => string

  /**
   * ProcessCommand経由で表示される説明
   * 実行に必須の引数がある場合はrun()内で置き換える
   */
  public description?: () => string

  /** // TODO: この仕組みが良いのか考え中s
   * 自身と子Processの状態を親に伝える
   * 実行に必須の引数がある場合はrun()内で置き換える
   */
  public describe = (): ProcessStateDescription => ({description: `${this.constructor.name}.describe() not implemented yet`})

  /** 全てのProcessのDecode後に呼び出される ※インスタンス化時には呼び出されない */
  public load?(processId: ProcessId): void
  public unload?(processId: ProcessId): void  // TODO: 呼び出す

  /**
   * 子Processの実行に引数が必要な場合、親Processが自身のrun()内で必要な引数を与えたexecutableを子Processにセットする
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public run = (processId: ProcessId): void => { }
}
