import { State, Stateful } from "os/infrastructure/state"

export type ProcessId = string
export type ProcessType = string

export interface ProcessState extends State {
  readonly i: ProcessId
  readonly t: ProcessType
}

export interface Process<T> extends Stateful {
  readonly processId: ProcessId

  run(args: T): void
}

/**
 * - run時にdriver詰め合わせを引数に入れる
 * - 上流のprocessは下流のprocessに対してdriverを組み替えて渡し、実行後に内容を改める
 */
