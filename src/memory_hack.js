/* eslint-disable */
// https://github.com/screepers/screeps-snippets/blob/master/src/misc/JavaScript/Memory%20Cache.js

const before = Game.cpu.getUsed();
var memhackMemory = Memory;
console.log("[memhack] memory reset. deserialization: " + (Game.cpu.getUsed() - before) + "cpu");

export const memhack = {
  // load() { main.tsからのimport時にルートレベルでのMemoryアクセスが発生するとその際にデシリアライズされてしまうためルートレベルで実行する
  //   const before = Game.cpu.getUsed();
  //   memhackMemory = Memory;
  //   console.log("[memhack] memory reset. deserialization: " + (Game.cpu.getUsed() - before) + "cpu");
  // },

  beforeTick() {
    if (memhackMemory) {
      delete global.Memory;
      global.Memory = memhackMemory;
    }
  },

  afterTick() {
    if (memhackMemory) {
      if (Game.serialization.canSkip() !== true) {
        RawMemory._parsed = Memory
      }
    }

    Game.serialization.tickFinished()
  },
}
