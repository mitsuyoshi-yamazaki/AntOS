/**
 # Process
 ## 概要
 動的に運用するために処理をまとめた単位

 ## 要件
 - 問題解決器はOSに組み込まず、まずはいちProcessとして実装する

 ## 仕様
 - 階層化される
   - 親子関係は
     - 親は任意に子を操作できる（任意のProcess間のメッセージングとは別）
     - 親は子の実行時に必須の引数を与えることができる
     - 実行時引数が不要なProcessのみ最上位（kernelが直接Memoryに保存する）になることができる
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
