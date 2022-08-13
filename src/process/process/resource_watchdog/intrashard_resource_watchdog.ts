/**
 # IntrashardResourceWatchdog
 ## 概要
 Shard内Roomの資源配分を管理する
 */

import { WatchDog, WatchDogState } from "./watchdog"

type Commands = "run" | "stop"
type CommandResponse = void

export interface IntrashardResourceWatchdogState extends WatchDogState {

}

export class IntrashardResourceWatchdog implements WatchDog<Commands, CommandResponse> {
  private constructor(
  ) { }

  public encode(): IntrashardResourceWatchdogState {
    return {
      t: "IntrashardResourceWatchdog",
    }
  }

  public static decode(state: IntrashardResourceWatchdogState): IntrashardResourceWatchdog {
    return new IntrashardResourceWatchdog()
  }

  public static create(): IntrashardResourceWatchdog {
    return new IntrashardResourceWatchdog()
  }

  public command(command: Commands): CommandResponse {
    switch (command) {
    case "run":
      return
    case "stop":
      return
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = command
      return
    }
    }
  }

  public run(): void {
    // TODO:
  }
}
