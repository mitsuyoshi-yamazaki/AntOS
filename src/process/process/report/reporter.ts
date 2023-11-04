import type { RoomName } from "shared/utility/room_name_types"

/**
# 仕様
- 使用プロセスは単純な形式でイベントを登録する
  - 何が どこで 何を どうした
- 3行程度にまとめる
 */

type RoomSubject = {
  readonly case: "room"
  readonly roomName: RoomName
}
type Subject = RoomSubject

type RoomPlace = {
  readonly case: "room"
  readonly roomName: RoomName
}
type Place = RoomPlace

// 目的語もここに入る
type Action = never

type Report = {
  readonly subject: Subject
  readonly place: Place
  readonly action: Action
}

const reports: Report[] = []

export const ReportCollector = {
  report(report: Report): void {
    reports.push(report)
  },

  clearReport(): void {
    reports.splice(0, reports.length)
  },
}

export const Reporter = {
  createEventReports(): [0, []] | [1, [string]] | [2, [string, string]] | [3, [string, string, string]] {
    return [1, ["event report"]]
  },

  /**
   * @param detail 詳細の詳しさ。単位は行
   */
  createStatusReports(detail: 1 | 2 | 3): string[] {
    return ["status report"]
  },
}
