export class CpuMeasurer {
  public constructor(
    private readonly handler: (identifier: string, cpuUsage: number) => void,
    private readonly threshold: number,
  ) { }

  public measure<T>(f: () => T, identifier: string): T {
    const before = Game.cpu.getUsed()
    const result: T = f()
    const cpuUsage = Game.cpu.getUsed() - before

    if (cpuUsage >= this.threshold) {
      this.handler(identifier, cpuUsage)
    }

    return result
  }
}

export class CpuPointMeasurer {
  private current = {
    cpuUsage: Game.cpu.getUsed(),
    status: "init",
  }

  public constructor(
    private readonly handler: (identifier: string, cpuUsage: number) => void,
    private readonly threshold: number,
    private identifier: string,
  ) { }

  public reset(identifier: string): void {
    this.identifier = identifier
    this.current = {
      cpuUsage: Game.cpu.getUsed(),
      status: "reset",
    }
  }

  public measure(status: string): void {
    const current = {
      cpuUsage: Game.cpu.getUsed(),
      status,
    }
    const usage = current.cpuUsage - this.current.cpuUsage

    if (usage < this.threshold) {
      this.current = current
      return
    }

    this.handler(`[${this.current.status} = ${current.status}] ${this.identifier}`, usage)
    this.current = current
  }
}
