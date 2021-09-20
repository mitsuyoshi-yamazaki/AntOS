import { State } from "os/infrastructure/state"

export interface ProcessState extends State {
  /** launch time */
  l: number

  /** process ID */
  i: number
}
