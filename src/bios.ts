import { memhack } from "./memory_hack"
// import * as ScreepsProfiler from "screeps-profiler" // Game.profiler.profile(ticks)

// BIOS Function
// import { InterShardMemoryManager } from "shared/bios_function/functions/inter_shard_memory"
import { Cpu } from "shared/bios_function/functions/cpu"

// Import
import { BootLoader } from "./boot_loader"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { SemanticVersion } from "shared/utility/semantic_version"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { BiosFunction } from "shared/bios_function/bios_function"
import { SerializableObject } from "shared/utility/serializable_types"
import { Mutable } from "shared/utility/types"

/**
# BIOS
## 概要
- OSより上位のゲーム全体に関わる処理を行う

## 責任範囲
- OSより責任範囲が広いもの全て
  - memhack
  - 処理全体のCPU監視
  - InterShardMemory
  - CPU, Memory使用量
  - Profiler
 */

// TODO: Memoryのルートに置いていた処理をBIOSの名前空間以下に移動

console.log("Loading BIOS...")
memhack.load()  // 全ての処理に優先して（Memoryアクセスのあるより先に）読み込む必要がある


type BiosMemory = {
  readonly functions: {[FunctionName: string]: SerializableObject}
}
const initializeBiosMemory = (memory: unknown): BiosMemory => {
  const mutableMemroy = memory as Mutable<BiosMemory>

  if (mutableMemroy.functions == null) {
    mutableMemroy.functions = {}
  }

  return mutableMemroy
}


const biosFunctions: BiosFunction<string, SerializableObject>[] = [
  // CPUは常に先頭
  Cpu,

  // InterShardMemoryManager,
]
const reversedBiosFunctions = [...biosFunctions].reverse()

let biosMemory = {} as BiosMemory

const rootFunctions = BootLoader.load()
let loopExecuted = Game.time - 1
const mainLoop = rootFunctions.loop

export const Bios = {
  version: new SemanticVersion(1, 2, 0),

  load(memory: unknown): void {
    console.log(ConsoleUtility.colored(`Rebooted at ${Game.time}, BIOS ${this.version}`, "warn"))

    biosMemory = initializeBiosMemory(memory)

    biosFunctions.forEach(<FunctionName extends string, FunctionMemory extends SerializableObject>(func: BiosFunction<FunctionName, FunctionMemory>) => {
      if (biosMemory.functions[func.name] == null) {
        biosMemory.functions[func.name] = {}
      }
      ErrorMapper.wrapLoop((): void => {
        func.load(biosMemory.functions[func.name] as FunctionMemory)
      }, "BiosFunction.load()")()
    })

    rootFunctions.load()

    // ScreepsProfiler.enable()  // TODO: 普段はオフにしておく
  },

  loop(): void {
    if (loopExecuted < Game.time - 1) {
      console.log(ConsoleUtility.colored(`[${Game.time}]`, "error") + ` the program didn't finish in the previous tick: last finished time: ${loopExecuted} (${Game.time - loopExecuted} ticks ago)`)
    }

    memhack.beforeTick()

    biosFunctions.forEach(func => {
      ErrorMapper.wrapLoop((): void => {
        func.startOfTick()
      }, "BiosFunction.startOfTick()")()
    })


    // ScreepsProfiler.wrap(mainLoop) // こちらを実行する場合は、mainLoopの呼び出しは停止する
    mainLoop()

    reversedBiosFunctions.forEach(func => {
      ErrorMapper.wrapLoop((): void => {
        biosMemory.functions[func.name] = func.endOfTick()
      }, "BiosFunction.endOfTick()")()
    })


    memhack.afterTick() // Memory書き込みがある全ての処理の後に実行する必要がある

    // TODO: 旧ソースに依存している
    const all_cpu = Math.ceil(Game.cpu.getUsed())
    Memory.cpu_usages.push(all_cpu)

    loopExecuted = Game.time
  },
}

/**
 * 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 53 59 61 67 71 73 79 83 89 97 101 103 107 109 113 127 131 137 139 149 151 157 163 167 173 179 181 191 193 197 199 211 223 227 229 233 239 241 251 257 263 269 271 277 281 283 293 307 311 313 317 331 337 347 349 353 359 367 373 379 383 389 397 401 409 419 421 431 433 439 443 449 457 461 463 467 479 487 491 499 503 509 521 523 541 547 557 563 569 571 577 587 593 599 601 607 613 617 619 631 641 643 647 653 659 661 673 677 683 691 701 709 719 727 733 739 743 751 757 761 769 773 787 797 809 811 821 823 827 829 839 853 857 859 863 877 881 883 887 907 911 919 929 937 941 947 953 967 971 977 983 991 997
 * 1511 2099 4099 10009
 */
