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
 */

/*
calls		time		avg		function
3046123		34484.2		0.011		Structure.isActive
74813		14863.8		0.199		Creep.moveTo
54576		11165.2		0.205		Creep.move
46795		9777.6		0.209		Creep.moveByPath
35856		6417.4		0.179		Creep.harvest
11086		2220.0		0.200		Creep.repair
8880		2160.0		0.243		RoomPosition.findPathTo
8880		2076.9		0.234		Room.findPath
9626		1849.5		0.192		Creep.reserveController
9626		1807.8		0.188		Creep.signController
10300		1765.0		0.171		Creep.upgradeController
22526		1560.2		0.069		Creep.withdraw
31276		1128.7		0.036		Creep.transfer
327418		1087.2		0.003		Room.find
3420		700.4		0.205		Creep.drop
3018		631.5		0.209		Creep.attack
1918		395.2		0.206		Creep.heal
6035		356.1		0.059		Room.createConstructionSite
137162		230.7		0.002		RoomPosition.isNearTo
16213		186.6		0.012		RoomPosition.findInRange
1580		174.3		0.110		RoomPosition.positionsInRange
109695		138.1		0.001		RoomPosition.encode
3537		122.7		0.035		RoomPosition.findClosestByPath
Avg: 98.59	Total: 98394.95	Ticks: 998
*/
