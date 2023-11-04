import { RoomResources } from "room_resource/room_resources"
import type { RCL, RoomName } from "shared/utility/room_name_types"
import { roomSectorNameOf } from "utility/room_coordinate"

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
