import { Kernel } from "./kernel"

export const BootLoader = {
  loadKernel(): Kernel {
    return new Kernel([]) // TODO:
  },
}
