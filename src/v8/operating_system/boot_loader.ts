import { Kernel, KernelMemory } from "./kernel"

export const BootLoader = {
  load(): void {
    registerDrivers()
  },
}

/// Driverの呼び出し順は依存があるためここ一箇所で登録する
const registerDrivers = (): void => {
  // TODO:
}
