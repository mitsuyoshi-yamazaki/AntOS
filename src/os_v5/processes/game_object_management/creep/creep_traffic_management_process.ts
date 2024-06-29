import { Process, ProcessDefaultIdentifier, processDefaultIdentifier, ProcessDependencies, ProcessId } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { EmptySerializable } from "os_v5/utility/types"
import { RoomName } from "shared/utility/room_name_types"


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

export type CreepTrafficManagementProcessApi = {
  registerCreepPositions(room: Room, creepMoves: CreepMove[]): void // TODO: コールバック関数を引数に渡せるようにする
}


ProcessDecoder.register("CreepTrafficManagementProcess", (processId: CreepTrafficManagementProcessId) => CreepTrafficManagementProcess.decode(processId))

export type CreepTrafficManagementProcessId = ProcessId<void, ProcessDefaultIdentifier, CreepTrafficManagementProcessApi, EmptySerializable, CreepTrafficManagementProcess>


export class CreepTrafficManagementProcess extends Process<void, ProcessDefaultIdentifier, CreepTrafficManagementProcessApi, EmptySerializable, CreepTrafficManagementProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private readonly roomMoveReservations = new Map<RoomName, RequestsInRoom>()

  private constructor(
    public readonly processId: CreepTrafficManagementProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: CreepTrafficManagementProcessId): CreepTrafficManagementProcess {
    return new CreepTrafficManagementProcess(processId)
  }

  public static create(processId: CreepTrafficManagementProcessId): CreepTrafficManagementProcess {
    return new CreepTrafficManagementProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): CreepTrafficManagementProcessApi {
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
