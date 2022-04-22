declare module "screeps-profiler"

declare module "memory_hack" {
  export const memhack: {
    load(): void
    beforeTick(): void
  }
}
