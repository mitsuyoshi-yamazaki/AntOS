/**
 # Process
 ## 概要
 動的に運用するために処理をまとめた単位

 ## Discussion
 - 親が認知しない子を実行時に追加できるか（必須の情報を与える静的型チェックを抜けられるか）？
   - 子のstateを親に入れるなら可能
   - 複数の親を持てない問題がある
     - 自roomとtarget roomの情報など
     - Driverか何かにまとめられないのか
   - そもそもstateから復帰する際に型情報は全て消える
     - →復帰する際に型情報含めて復帰させる = 永続化時に型情報を含めてstateにすれば解決するか
       - ProcessArgumentがprocessの実行に必須の情報を取得し、それを渡す
 - 階層化は必要か？
 */

import { State, Stateful } from "os/infrastructure/state"
import type { CompressedProcessType, ProcessType } from "./process_type"

export type ProcessId = string

export interface ProcessState extends State {
  readonly i: ProcessId
  readonly t: CompressedProcessType
}

export interface Process<T, S, U, R> extends Stateful {
  readonly processId: ProcessId
  readonly processType: ProcessType

  run(args: T): S
  handleSubprocesses?(result: U): R
}
