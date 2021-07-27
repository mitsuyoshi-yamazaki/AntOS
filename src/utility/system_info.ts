export type ShortVersionV3 = "v3"
export type ShortVersionV5 = "v5"
export type ShortVersionV6 = "v6"

const shortVersionV3: ShortVersionV3 = "v3"
const shortVersionV5: ShortVersionV5 = "v5"
const shortVersionV6: ShortVersionV6 = "v6"

export type ShortVersion = ShortVersionV3 | ShortVersionV5 | ShortVersionV6
export const ShortVersion = {
  v3: shortVersionV3,
  v5: shortVersionV5,
  v6: shortVersionV6,
}

export const SystemInfo = {
  os: {
    version: "1.0.14",
    name: "AntOS",
  },
  application: {
    version: "6.2.73",
    shortVersionString: ShortVersion.v6,
    name: "ProblemSolver",
  },
}
