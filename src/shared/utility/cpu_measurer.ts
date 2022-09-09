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
  private cpuUsage = Game.cpu.getUsed()

  public constructor(
    private readonly handler: (identifier: string, cpuUsage: number) => void,
    private readonly threshold: number,
  ) { }

  public reset(): void {
    this.cpuUsage = Game.cpu.getUsed()
  }

  public measure(identifier: string): void {
    const previous = this.cpuUsage
    this.cpuUsage = Game.cpu.getUsed()
    const usage = this.cpuUsage - previous

    if (usage < this.threshold) {
      return
    }

    this.handler(identifier, usage)
  }
}
