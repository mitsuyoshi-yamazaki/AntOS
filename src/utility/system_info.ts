export type ShortVersionV5 = "v5"
export type ShortVersionV6 = "v6"
export type ShortVersionV7 = "v7"
export type ShortVersionV9 = "v9"

const shortVersionV5: ShortVersionV5 = "v5"
const shortVersionV6: ShortVersionV6 = "v6"
const shortVersionV7: ShortVersionV7 = "v7"
const shortVersionV9: ShortVersionV9 = "v9"

export type ShortVersion = ShortVersionV5 | ShortVersionV6 | ShortVersionV7 | ShortVersionV9
export const ShortVersion = {
  v5: shortVersionV5,
  v6: shortVersionV6,
  v7: shortVersionV7,
  v9: shortVersionV9,
}

export const SystemInfo = {
  os: {
    version: "3.1.3",
    name: "AntOS",
  },
  application: {
    version: "9.0.11",
    name: "Declarative AI",
  },
}
