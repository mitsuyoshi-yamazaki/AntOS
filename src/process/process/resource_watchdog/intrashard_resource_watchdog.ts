/**
 # IntrashardResourceWatchdog
 ## 概要
 Shard内Roomの資源配分を管理する

 ## WatchDog
 ### 目的
 - 必要な資源を利用できること
 - 損失を最小限に抑えること
   - Roomの喪失
   - 転送Energy

 ### 状態
 - Terminalに常に空きがある
 - おおよそ資源が分散管理されている
 - その部屋が必要とする資源がある
   - Energyはほとんど常に必要
 */

import { WatchDog, WatchDogState } from "./watchdog"

export interface IntrashardResourceWatchdogState extends WatchDogState {

}

export class IntrashardResourceWatchdog implements WatchDog {
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

  public explainCurrentState(): string {
    const explanation: string[] = []

    return explanation.join("\n")
  }

  public run(): void {
    // TODO:
  }
}
