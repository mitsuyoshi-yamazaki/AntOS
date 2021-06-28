/**
 * - 以下の情報を格納する
 *   - problem solverがobjectiveを決定するのに必要な情報
 *   - メモリに載っているがほとんど変化しない情報
 */

export const epicScenes: { description: string, url: string }[] = [
  {
    description: "Attacking invader Lv5 stronghold",
    url: "https://screeps.com/a/#!/history/shard2/W6S35?t=33901209",
  },
]

/**
 * - strategy
 *   - room bootstrap
 *     - W1C1M1でharvest, C1M1でcarry (300 energy)
 */
