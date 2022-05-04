import { Kernel, KernelMemory } from "./kernel"

export const BootLoader = {
  load(kernelMemory: KernelMemory): Kernel {
    const kernel = new Kernel(kernelMemory)
    registerDrivers(kernel)

    return kernel
  },
}

/// Driverの呼び出し順は依存があるためここ一箇所で登録する
const registerDrivers = (kernel: Kernel): void => {
  // TODO:
}
