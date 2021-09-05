export type ShortVersionV5 = "v5"
export type ShortVersionV6 = "v6"

const shortVersionV5: ShortVersionV5 = "v5"
const shortVersionV6: ShortVersionV6 = "v6"

export type ShortVersion = ShortVersionV5 | ShortVersionV6
export const ShortVersion = {
  v5: shortVersionV5,
  v6: shortVersionV6,
}

export const SystemInfo = {
  os: {
    version: "1.1.2",
    name: "AntOS",
  },
  application: {
    version: "7.0.12",
    shortVersionString: ShortVersion.v6,
    name: "Declarative AI",
  },
}
