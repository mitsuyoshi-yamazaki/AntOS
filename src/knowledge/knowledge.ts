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
 * - 敵のSpawnをCreepで囲うことはできない（敵のCreepが出てくる際に踏まれて死ぬ
 */
