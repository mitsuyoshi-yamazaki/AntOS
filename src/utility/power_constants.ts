import type { Timestamp } from "./timestamp"

const powerTypes = [
  "regenSource",
  "operateSpawn",
  "operateFactory",
] as const
type PowerType = typeof powerTypes[number]

type PowerInfo = {
  value: number[]
  duration: Timestamp
  opsCost: number
  cooldown: Timestamp
  range: number
}

type PowerConstantsInterface = {[Key in PowerType]: PowerInfo}

export const PowerGameConstants: PowerConstantsInterface = {
  regenSource: {
    value: [50, 100, 150, 200, 250],  // regenerate energy units
    duration: 15, // every 15 ticks
    opsCost: 0,
    cooldown: 100,
    range: 3,
  },
  operateSpawn: {
    value: [10, 30, 50, 65, 80],  // reduce spawn time
    duration: 1000,
    opsCost: 100,
    cooldown: 300,
    range: 3,
  },
  operateFactory: {
    value: [1, 2, 3, 4, 5],  // factory level
    duration: 1000,
    opsCost: 100,
    cooldown: 800,
    range: 3,
  },
}
