import "ts-polyfill/lib/es2019-array"

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { Bios } from "./bios"

console.log("Loading main script...")

if (Memory.bios == null) {
  Memory.bios = {}
}

Bios.load(Memory.bios)

export const loop = ErrorMapper.wrapLoop(() => {
  Bios.loop()
}, "Main")
