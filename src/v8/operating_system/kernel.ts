import { Driver } from "../driver/driver"

export class Kernel {
  public constructor(
    private readonly drivers: Driver[],
  ) {
  }
}
