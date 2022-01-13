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
 * - Pathfinder.searchオプションのfleeは離れたいrangeを設定しないと値を返さない
 * - Dismantler, Attackerは常時自己再生をしていないので二発耐えられないといけない
 * - createFlag()/remove()実行tickで状態が変化しない
 * - BotArena等にデプロイするにはscreepsmod-authにパスワードを設定する必要がある
 *   - https://github.com/ScreepsMods/screepsmod-auth
 */

/*
// Renders a cost matrix as HTML table for console output.
renderCostMatrix(matrix: CostMatrix, roomName ?: string): string {
  const terrain = roomName && Game.map.getRoomTerrain(roomName);

  let output = '<table style="display: inline-block">';
  for (let y = 0; y < 50; y++) {
    output += '<tr style="height: 2px">'
    for (let x = 0; x < 50; x++) {
      let value = matrix.get(x, y);
      if (value === 0 && roomName) {
        // Simulate fallback to room terrain values.
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
          value = 255;
        }
      }

      // Generate color gradient for matrix values of 1-99.
      let color = 'gray';
      if (value >= 100) color = 'black'
      else if (value >= 75) color = 'rgb(' + Math.round(255 * (1 - (value - 75) / 25)) + ', 0, 255)'
      else if (value >= 50) color = 'rgb(255, 0, ' + Math.round(255 * (value - 50) / 25) + ')'
      else if (value >= 25) color = 'rgb(255, ' + Math.round(255 * (1 - (value - 25) / 25)) + ', 0)'
      else if (value > 0) color = 'rgb(' + Math.round(255 * value / 25) + ', 255, 0)'

      output += '<td style="width: 2px; background: ' + color + '"></td>';
    }
    output += '</tr>';
  }
  output += '</table>';
  return output;
}
 */
