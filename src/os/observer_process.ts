import {
  Process,
  ProcessId,
  PriorityInformation,
  ProcessRequirement,
  ProcessResult,
} from "./process"

/**
 * ゲームイベントを監視する
 * - OS直下の監視役プロセス
 * - 監視を実行する物理実体のinterface
 * - イベント通知を受け取るinterface
 */
// export class ObserverProcess implements Process {
//   public get parentProcessId(): ProcessId {
//     return 0
//   }

//   public get priority(): PriorityInformation {
//     return {}
//   }

//   public run(requirement: ProcessRequirement): ProcessResult {
//     return {}
//   }
// }
