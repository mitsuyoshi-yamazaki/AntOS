import { ErrorMapper } from "ErrorMapper"
import { init } from "extensions"

export const loop = ErrorMapper.wrapLoop(() => {
  const before_cpu_usage = Game.cpu.getUsed()

  init()

  const after_cpu_usage = Game.cpu.getUsed()

  Memory.cpu_usages.push(Math.ceil(after_cpu_usage - before_cpu_usage))
})
