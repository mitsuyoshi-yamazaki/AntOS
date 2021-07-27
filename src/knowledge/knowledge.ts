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
 *   - Safemode下のみの挙動かもしれない
 * - Creep APIで失敗する際、まずERR_NO_BODYPARTチェックが入る
 *   - 次にERR_NOT_IN_RANGEが返る = まず近づかなければエラー判定ができない（ものもある
 * - Tower距離減衰
 *   - 30hits/1square
 * - Tombstoneも戦場の霧を晴らす
 * - Safemode環境下での攻撃行動はERR_NO_BODYPARTを返す
 */
