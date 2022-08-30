import { State, Stateful } from "os/infrastructure/state"

export interface WatchDogState extends State {
}

export interface WatchDog extends Stateful {
  encode(): WatchDogState
  run(): void
}
