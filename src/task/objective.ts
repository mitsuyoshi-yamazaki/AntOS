import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { SignRoomObjective, SignRoomObjectiveState } from "task/sign_rooms/sign_rooms_objective"

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
// export type TaskPriority = TaskPriorityIfPossible | TaskPriorityNormal | TaskPriorityAlways

// export interface TaskExecutionCondition {
//   condition: "required" | "cancellable"
//   maxTickInterval: number   // maxTickIntervalに一度は必ず実行されるべき：毎tick実行する場合は1
//   minTickInterval?: number  // minTickInterval以下の間隔で実行する必要はない
//   currentPriority: TaskPriority
// }

export interface ObjectiveState extends State {
  /** type identifier */
  t: keyof ObjectiveTypes

  /** start time */
  s: number

  /** children objective state */
  c: ObjectiveState[]
}

export interface Objective extends Stateful {
  startTime: number
  children: Objective[]

  encode(): ObjectiveState
}

class ExampleObjective implements Objective { // TODO: 他のObjectiveを実装したら消す
  public readonly startTime = 0
  public readonly children: Objective[] = []

  public encode(): ObjectiveState {
    return {
      t: "ExampleObjective",
      s: this.startTime,
      c: [],
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(state: ObjectiveState): ExampleObjective {
    return new ExampleObjective()
  }
}

class ObjectiveTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "SignRoomObjective" = (state: ObjectiveState) => SignRoomObjective.decode(state as SignRoomObjectiveState)
  "ExampleObjective" = (state: ObjectiveState) => ExampleObjective.decode(state as ObjectiveState)
}

export function decodeObjectiveFrom(state: ObjectiveState): Objective | null {
  let decoded: Objective | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new ObjectiveTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `restoreObjectiveFrom(), objective type: ${state.t}`)()
  return decoded
}
