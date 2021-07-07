import { State } from "os/infrastructure/state"
import type { ProcessTypeIdentifier } from "./process_decoder"

export interface ProcessState extends State {
  /** type identifier */
  t: ProcessTypeIdentifier

  /** launch time */
  l: number

  /** process ID */
  i: number
}
