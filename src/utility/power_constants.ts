import type { Timestamp } from "./timestamp"

interface PowerInfo {
  value: number[]
  duration: Timestamp
  opsCost: number
  cooldown: Timestamp
  range: number
}

interface PowerConstantsInterface {
  regenSource: PowerInfo
}

export const PowerGameConstants: PowerConstantsInterface = {
  regenSource: {
    value: [50, 100, 150, 200, 250],
    duration: 15,
    opsCost: 0,
    cooldown: 100,
    range: 3,
  },
}
