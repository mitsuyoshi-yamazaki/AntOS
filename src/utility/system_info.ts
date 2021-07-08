export type ShortVersionV3 = "v3"
export type ShortVersionV4 = "v4"
export type ShortVersionV5 = "v5"

const shortVersionV3: ShortVersionV3 = "v3"
const shortVersionV4: ShortVersionV4 = "v4"
const shortVersionV5: ShortVersionV5 = "v5"

export type ShortVersion = ShortVersionV3 | ShortVersionV4 | ShortVersionV5
export const ShortVersion = {
  v3: shortVersionV3,
  v4: shortVersionV4,
  v5: shortVersionV5,
}

export const SystemInfo = {
  os: {
    version: "1.0.0",
    name: "AntOS",
  },
  application: {
    version: "5.8.9",
    shortVersionString: ShortVersion.v5,
    name: "ProblemSolver",
  },
}
