export type ShortVersionV5 = "v5"
export type ShortVersionV6 = "v6"
export type ShortVersionV7 = "v7"

const shortVersionV5: ShortVersionV5 = "v5"
const shortVersionV6: ShortVersionV6 = "v6"
const shortVersionV7: ShortVersionV7 = "v7"

export type ShortVersion = ShortVersionV5 | ShortVersionV6 | ShortVersionV7
export const ShortVersion = {
  v5: shortVersionV5,
  v6: shortVersionV6,
  v7: shortVersionV7,
}

export const SystemInfo = {
  os: {
    version: "1.5.1",
    name: "AntOS",
  },
  application: {
    version: "7.2.67",
    shortVersionString: ShortVersion.v7,
    name: "Declarative AI",
  },
}
