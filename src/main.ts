import { ErrorMapper } from "ErrorMapper"
import { init } from "extensions"
import { test } from "test";

export const loop = ErrorMapper.wrapLoop(() => {
  const before_cpu_usage = Game.cpu.getUsed()

  ErrorMapper.wrapLoop(() => {
    init()
    test()

    Memory.refresh()

    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      creep.memory.position = {
        x: creep.pos.x,
        y: creep.pos.y,
        roomName: creep.pos.roomName,
      }
    }
  })()

  const after_cpu_usage = Game.cpu.getUsed()

  Memory.cpu_usages.push(Math.ceil(after_cpu_usage - before_cpu_usage))
})
