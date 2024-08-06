import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ProcessDefaultIdentifier } from "os_v5/process/process"
import { EmptySerializable } from "shared/utility/serializable_types"
import { RoomName } from "shared/utility/room_name_types"
import { RoomCoordinate } from "utility/room_coordinate"


type RoomTraverseStateEmpty = {
  readonly case: "highway" | "empty" | "source_keeper"
}
type RoomTraverseStateAllied = {
  readonly case: "mine" | "allied"
}
type RoomTraverseStateHostile = {
  readonly case: "hostile"
  readonly claimerName: string
}
type RoomTraverseStateObstacle = {
  readonly case: "obstacle" | "closed"
}
type RoomTraverseStateUnknown = {
  // closedではないがunobserved
  readonly case: "unknown"
}
type RoomTraverseStateInvalid = {
  readonly case: "invalid"
}
type RoomTraverseState = RoomTraverseStateEmpty
  | RoomTraverseStateAllied
  | RoomTraverseStateHostile
  | RoomTraverseStateObstacle
  | RoomTraverseStateUnknown
  | RoomTraverseStateInvalid


export type RoomMapProcessApi = {
  canTraverse(roomName: RoomName): boolean
  getTraverseState(roomName: RoomName): RoomTraverseState
}


ProcessDecoder.register("RoomMapProcess", (processId: RoomMapProcessId) => RoomMapProcess.decode(processId))

export type RoomMapProcessId = ProcessId<void, ProcessDefaultIdentifier, RoomMapProcessApi, EmptySerializable, RoomMapProcess>


export class RoomMapProcess extends Process<void, ProcessDefaultIdentifier, RoomMapProcessApi, EmptySerializable, RoomMapProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private traverseStateCache = new Map<RoomName, RoomTraverseState>()

  private constructor(
    public readonly processId: RoomMapProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: RoomMapProcessId): RoomMapProcess {
    return new RoomMapProcess(processId)
  }

  public static create(processId: RoomMapProcessId): RoomMapProcess {
    return new RoomMapProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return "TODO"
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): RoomMapProcessApi {
    return {
      canTraverse: (roomName: RoomName): boolean => {
        const state = this.getTraverseState(roomName)
        switch (state.case) {
        case "highway":
        case "empty":
        case "source_keeper":
        case "mine":
        case "allied":
          return true

        case "unknown":
          return true // 未探索部屋は通れるという扱いにしないと探索されない

        case "hostile":
        case "obstacle":
        case "closed":
        case "invalid":
          return false
        }
      },

      getTraverseState: (roomName: RoomName): RoomTraverseState => {
        console.log(`${this} getTraverseState() not implemented yet ${roomName}`) // TODO:
        return {
          case: "unknown",
        }
      },
    }
  }


  // Private
  private getTraverseState(roomName: RoomName): RoomTraverseState {
    const cached = this.traverseStateCache.get(roomName)
    if (cached != null) {
      return cached
    }

    const state = this.observe(roomName)
    this.traverseStateCache.set(roomName, state)
    return state
  }

  private observe(roomName: RoomName): RoomTraverseState {
    const room = Game.rooms[roomName]
    if (room == null) {
      const roomStatus = Game.map.getRoomStatus(roomName)
      if (roomStatus == null) {
        return { case: "closed" }
      }

      switch (roomStatus.status) {
      case "closed":
        return { case: "closed" }
      case "normal":
      case "novice":
      case "respawn":
        return { case: "unknown" }
      }
    }

    const coordinate = RoomCoordinate.parse(roomName)
    if (coordinate == null) {
      return { case: "unknown" }
    }

    switch (coordinate.roomType) {
    case "highway":
    case "highway_crossing":
      return { case: "highway" }
    case "sector_center":
    case "source_keeper":
      return { case: "source_keeper" }
    case "normal":
      if (room.controller == null) {
        return { case: "invalid" }
      }
      if (room.controller.my === true) {
        return { case: "mine" }
      }
      if (room.controller.owner != null) {
        return {
          case: "hostile",
          claimerName: room.controller.owner.username,
        }
      }
      return { case: "empty" }
    }
  }
}


// class RoomState {
//   public get lastObserved(): number | null {
//     if (this.observedTimestamp == null) {
//       return null
//     }
//     return Game.time - this.observedTimestamp
//   }
//   private observedTimestamp: Timestamp | null = null

//   public get traverseState(): RoomTraverseState {
//   }
//   private _traverseState: RoomTraverseState

//   public constructor(
//     public readonly roomName: RoomName,
//   ) {
//     const room = Game.rooms[roomName]
//     if (room != null) {
//       this._traverseState = this.getTraverseState(room)
//       this.observedTimestamp = Game.time
//     } else {
//       this._traverseState = {
//         case: "unknown",
//       }
//     }
//   }

//   public observe(): void {
//     const room = Game.rooms[this.roomName]
//     if (room == null) {
//       return
//     }

//     this._traverseState = this.getTraverseState(room)
//     this.observedTimestamp = Game.time
//   }

//   private getRoomState(): RoomTraverseState {
//     const roomStatus = Game.map.getRoomStatus(this.roomName)
//     if (roomStatus == null) {

//     }

//     switch (roomStatus.status) {
//     case "closed":
//       if (options?.allowClosedRoom !== true) {
//         throw `${roomLink(roomName)} is closed`
//       }
//       break

//     case "normal":
//     case "novice":
//     case "respawn":
//       break
//     }
//   }
// }
