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

1288811
calls		time		avg		function
7436		1520.5		0.204		Creep.moveTo
5286		1082.7		0.205		Creep.move
4545		953.8		0.210		Creep.moveByPath
3262		668.3		0.205		Creep.harvest
80512		372.2		0.005		Structure.isActive
870		251.1		0.289		RoomPosition.findPathTo
870		242.4		0.279		Room.findPath
1263		241.6		0.191		Creep.upgradeController
1105		230.3		0.208		Creep.repair
2596		219.1		0.084		Creep.withdraw
734		147.0		0.200		Creep.reserveController
3395		126.2		0.037		Creep.transfer
529		108.1		0.204		Creep.drop
32368		102.8		0.003		Room.find
1181		53.3		0.045		Creep.pickup
200		44.2		0.221		Creep.heal
483		31.8		0.066		Room.createConstructionSite
1688		29.1		0.017		RoomPosition.findInRange
13126		24.5		0.002		RoomPosition.isNearTo
11542		16.8		0.001		RoomPosition.encode
344		14.4		0.042		RoomPosition.findClosestByPath
7788		12.8		0.002		RoomPosition.inRangeTo
6333		11.3		0.002		RoomPosition.getRangeTo
1472		11.0		0.007		RoomPosition.lookFor
Avg: 79.29	Total: 7769.99	Ticks: 98
*/
