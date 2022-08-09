import { ProcessSchedulerMemory } from "./process_scheduler"

export type KernelMemory = {
  enabled: boolean  // FixMe: 前バージョンの動作を妨げないためのもの：運用開始したら消す

  process: ProcessSchedulerMemory
}
