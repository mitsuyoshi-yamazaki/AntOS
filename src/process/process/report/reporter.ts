import { RoomResources } from "room_resource/room_resources"
import type { RCL, RoomName } from "shared/utility/room_name_types"
import { roomSectorNameOf } from "utility/room_coordinate"
// import {} from "./report_db"
import { Sentence } from "./language"

/**
# 仕様
- 使用プロセスは単純な形式でイベントを登録する
  - 何が どこで 何を どうした
- Reportは日の単位でアーカイブし、古いものは破棄する
  - → ProcessではなくDriver側で管理する（Processはアクセサ）
 */

export type ReporterMemory = {
  reportTimeHour: number
  reportStoreDuration: number /// number of days
}

type Report = Sentence

type Day = number
const dailyReports: {day: Day, reports: Report[]}[] = []

export const ReportCollector = {
  addReport(report: Report): void {
    const day = (new Date()).getDay()

    if (dailyReports[0] == null || dailyReports[0].day !== day) {
      if (dailyReports.length >= Memory.reporter.reportStoreDuration) {
        dailyReports.pop()
      }

      dailyReports.push({
        day,
        reports: [report],
      })
      return
    }

    dailyReports[0].reports.push(report)
  },

  addReports(reports: Report[]): void {
    const day = (new Date()).getDay()

    if (dailyReports[0] == null || dailyReports[0].day !== day) {
      if (dailyReports.length >= Memory.reporter.reportStoreDuration) {
        dailyReports.pop()
      }

      dailyReports.push({
        day,
        reports: [...reports],
      })
      return
    }

    dailyReports[0].reports.push(...reports)
  },
}

export const ReportStore = {
  setReportTimeHour(hour: number): void {
    Memory.reporter.reportTimeHour = hour
  },

  getReportTimeHour(): number {
    return Memory.reporter.reportTimeHour
  },

  setReportStoreDuration(duration: number): void {
    Memory.reporter.reportStoreDuration = duration
  },

  getReportStoreDuration(): number {
    return Memory.reporter.reportStoreDuration
  },

  getDailyReports(): { day: Day, reports: Report[] }[] {
    return [...dailyReports]
  },
}

export const Reporter = {
  createEventReports(): [0, []] | [1, [string]] | [2, [string, string]] | [3, [string, string, string]] {
    return [1, ["no events to report"]]
  },

  /**
   * @param detail 詳細の詳しさ。単位は行
   */
  createStatusReports(detail: 1 | 2 | 3): string[] {
    const roomStatus = getRoomStatus()
    const ownedRoomCount = roomStatus.sectors.reduce((result, sector) => {
      return result + sector.ownedRooms.length
    }, 0)

    return [`${roomStatus.sectors.length} sectors, ${ownedRoomCount} rooms`]
  },
}

type SectorStatus = {
  readonly name: RoomName
  readonly ownedRooms: {
    readonly name: RoomName
    readonly rcl: RCL
  }[]
}
const getRoomStatus = (): { sectors: SectorStatus[] } => {
  const sectors = new Map<RoomName, SectorStatus>()

  RoomResources.getOwnedRoomResources().forEach(roomResource => {
    const sectorName = roomSectorNameOf(roomResource.room.name) ?? "unknown"
    const sectorStatus = ((): SectorStatus => {
      const cached = sectors.get(sectorName)
      if (cached != null) {
        return cached
      }
      const newValue: SectorStatus = { name: sectorName, ownedRooms: [] }
      sectors.set(sectorName, newValue)
      return newValue
    })()

    sectorStatus.ownedRooms.push({
      name: roomResource.room.name,
      rcl: roomResource.controller.level as RCL,
    })
  })

  return {
    sectors: Array.from(sectors.values())
  }
}


/**
      roomVersions.forEach((controllers, version) => {
        if (controllers.length <= 6) {
          PrimitiveLogger.log(`${controllers.length} ${version} rooms: ${controllers.map(controller => detailedRoomLink(controller)).join(", ")}`)
          return
        }
        const sectors = new ValuedArrayMap<string, StructureController>()
        controllers.forEach(controller => {
          const roomName = controller.room.name
          const sectorName = roomSectorNameOf(roomName)
          if (sectorName == null) {
            PrimitiveLogger.programError(`Cannot get sector name of ${roomLink(roomName)}`)
            return
          }
          sectors.getValueFor(sectorName).push(controller)
        })
        PrimitiveLogger.log(`${controllers.length} ${version} rooms:\n${Array.from(sectors.entries()).map(([sectorName, controllersInSector]) => `- ${sectorName}: ${controllersInSector.map(controller => detailedRoomLink(controller)).join(", ")}`).join("\n")}`)
      })

 */
