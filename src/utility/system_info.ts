export type ShortVersionV3 = "v3"
export type ShortVersionV5 = "v5"

const shortVersionV3: ShortVersionV3 = "v3"
const shortVersionV5: ShortVersionV5 = "v5"

export type ShortVersion = ShortVersionV3 | ShortVersionV5
export const ShortVersion = {
  v3: shortVersionV3,
  v5: shortVersionV5,
}

export const SystemInfo = {
  os: {
    version: "1.0.0",
    name: "AntOS",
  },
  application: {
    version: "5.8.25",
    shortVersionString: ShortVersion.v5,
    name: "ProblemSolver",
  },
}
