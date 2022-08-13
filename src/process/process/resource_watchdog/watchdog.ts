import { State, Stateful } from "os/infrastructure/state"

export interface WatchDogState extends State {
}

export interface WatchDog<Commands, CommandResponse> extends Stateful {
  encode(): WatchDogState

  command(command: Commands): CommandResponse
  run(): void
}
