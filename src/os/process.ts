export interface CpuUsage {
  time: number
}

export interface Process {
  id: number
  cpuUsage: CpuUsage

  suspend(): void
  resume(): void
  kill(): void
}
