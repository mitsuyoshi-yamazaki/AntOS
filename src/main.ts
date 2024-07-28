import "ts-polyfill/lib/es2019-array"

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { Bios } from "./bios"

Bios.load()

export const loop = ErrorMapper.wrapLoop(() => {
  Bios.loop()
}, "Main")
