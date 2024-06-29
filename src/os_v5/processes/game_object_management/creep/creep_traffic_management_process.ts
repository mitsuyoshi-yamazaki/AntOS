import { Process, ProcessDefaultIdentifier, processDefaultIdentifier, ProcessDependencies, ProcessId } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { EmptySerializable } from "os_v5/utility/types"
import { RoomName } from "shared/utility/room_name_types"

/**
# CreepTrafficManagerProcess
## 概要

## ライフサイクル
- 全体でCostMatrixを作成
- [Discussion] 全ての移動処理をTrafficManagerで行えるか？
 */

type CreepTrafficPositionState = "fatigue" | "static" | "conbat" | "economy" | "random"
const creepTrafficPositionPriority = {
  urgent: 0,
  high: 10,
  normal: 20,
  low: 30,
}

const creepTraffcAlternativePositionPriority = {
  good: 0,
  possible: 10,
  badBut: 20,
  notWorking: 30,
}

type Move = {
  readonly direction: DirectionConstant | "stay"
  readonly priority: number
}
type CreepMove = {
  readonly creep: Creep
  readonly moves: Move[]
  readonly state: CreepTrafficPositionState
}
type RequestsInRoom = {
  readonly room: Room
  readonly creepMoves: CreepMove[]
}

export type CreepTrafficManagerProcessApi = {
  registerCreepPositions(room: Room, creepMoves: CreepMove[]): void // TODO: コールバック関数を引数に渡せるようにする
}


ProcessDecoder.register("CreepTrafficManagerProcess", (processId: CreepTrafficManagerProcessId) => CreepTrafficManagerProcess.decode(processId))

export type CreepTrafficManagerProcessId = ProcessId<void, ProcessDefaultIdentifier, CreepTrafficManagerProcessApi, EmptySerializable, CreepTrafficManagerProcess>


export class CreepTrafficManagerProcess extends Process<void, ProcessDefaultIdentifier, CreepTrafficManagerProcessApi, EmptySerializable, CreepTrafficManagerProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private readonly roomMoveReservations = new Map<RoomName, RequestsInRoom>()

  private constructor(
    public readonly processId: CreepTrafficManagerProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: CreepTrafficManagerProcessId): CreepTrafficManagerProcess {
    return new CreepTrafficManagerProcess(processId)
  }

  public static create(processId: CreepTrafficManagerProcessId): CreepTrafficManagerProcess {
    return new CreepTrafficManagerProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): CreepTrafficManagerProcessApi {
    this.roomMoveReservations.clear()

    return {
      registerCreepPositions: (room: Room, creepMoves: CreepMove[]): void => {
        this.getRequestsIn(room).creepMoves.push(...creepMoves)
      }
    }
  }

  public runAfterTick(): void {

  }


  // Private
  private getRequestsIn(room: Room): RequestsInRoom {
    const stored = this.roomMoveReservations.get(room.name)
    if (stored != null) {
      return stored
    }

    const newRequests: RequestsInRoom = {
      room,
      creepMoves: [],
    }
    this.roomMoveReservations.set(room.name, newRequests)
    return newRequests
  }
}
