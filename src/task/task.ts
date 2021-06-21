
export interface TaskExecutionCondition {
  condition: "required" | "cancellable"
  maxTickInterval: number   // maxTickIntervalに一度は必ず実行されるべき：毎tick実行する場合は1
  minTickInterval?: number  // minTickInterval以下の間隔で実行する必要はない
  currentPriority: TaskPriority
}

/**
 * - https://zenn.dev/mitsuyoshi/scraps/3917e7502ef385#comment-e0d2fee7895843
 * - Prioritize
 *   - CPU時間が余っている→全て実行
 *   - bucketを食っている→
 *     - alwaysを実行
 *     - normalの順位づけを行い、時間いっぱいまで実行→
 *       - 足りなかったら次tickへ持ち越し
 *       - 余ったら次の順位を実行→
 *         - 全て実行しても余ったらif possibleを実行
 */
export interface TaskPriority {
  taskPriorityType: string
}

// Lowest
// CPU時間が逼迫したら停止される
export interface TaskPriorityIfPossible {
  taskPriorityType: "if_possible"
}

// Medium
// CPU時間が逼迫したら実行間隔を落とされる
export interface TaskPriorityNormal {
  taskPriorityType: "normal"
}

// Highest
// 常に実行される
// TODO: lintで禁止
export interface TaskPriorityAlways {
  taskPriorityType: "always"
}
