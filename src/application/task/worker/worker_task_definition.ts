import type { RoomName } from "utility/room_name"
import type { TaskIdentifier } from "v5_task/task"

/**
 * - 要件：
 *   - どの具象タスクを選択するか機械的に判断する情報
 * - Primitive:
 *   - 最低限
 *   - 必ずこれは実行できる
 * - EnergySource, EnergyStoreを実装すればPrimitiveのみで運用できるのでは
 */
export interface WorkerTaskDefinition {

}

export function createWorkerTaskIdentifier(roomName: RoomName): TaskIdentifier {
  return `WorkerTask_${roomName}`
}
