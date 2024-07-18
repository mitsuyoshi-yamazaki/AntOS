import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ProcessDefaultIdentifier } from "os_v5/process/process"
import { TerrainCacheProcessApi } from "./terrain_cache_process"
import { Position } from "shared/utility/position_v2"
import { RoomPath, RoomPathState } from "./room_path"
import { RoomName } from "shared/utility/room_name_types"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { strictEntries } from "shared/utility/strict_entries"


type FindPathOptions = {
  readonly shouldCache?: true
  readonly range?: number
}

export type PathManagerProcessApi = {
  findPath(room: Room, start: Position, end: Position, options?: FindPathOptions): RoomPath | null
}

type PathManagerProcessState = {
  readonly p: {[R: RoomName]: RoomPathState[]}
}

type Dependency = TerrainCacheProcessApi


ProcessDecoder.register("PathManagerProcess", (processId: PathManagerProcessId, state: PathManagerProcessState) => PathManagerProcess.decode(processId, state))

export type PathManagerProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, PathManagerProcessApi, PathManagerProcessState, PathManagerProcess>


export class PathManagerProcess extends Process<Dependency, ProcessDefaultIdentifier, PathManagerProcessApi, PathManagerProcessState, PathManagerProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "TerrainCacheProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly roomPaths = new ValuedArrayMap<RoomName, RoomPath>()

  private constructor(
    public readonly processId: PathManagerProcessId,
    private readonly roomPathStates: { [R: RoomName]: RoomPathState[]},
  ) {
    super()

    ;
    (strictEntries(roomPathStates) as [RoomName, RoomPathState[]][]).forEach(([roomName, states]) => {
      this.roomPaths.set(roomName, states.map(state => RoomPath.decode(state, roomName)))
    })
  }

  public encode(): PathManagerProcessState {
    return {
      p: this.roomPathStates,
    }
  }

  public static decode(processId: PathManagerProcessId, state: PathManagerProcessState): PathManagerProcess {
    return new PathManagerProcess(processId, state.p)
  }

  public static create(processId: PathManagerProcessId): PathManagerProcess {
    return new PathManagerProcess(processId, {})
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `Paths in ${this.roomPaths.size} rooms`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): PathManagerProcessApi {
    return {
      findPath: (room: Room, start: Position, end: Position, options?: FindPathOptions): RoomPath | null => this.findPath(room, start, end, options),
    }
  }


  // Private
  private findPath(room: Room, start: Position, end: Position, options?: FindPathOptions): RoomPath | null {
    const pathFinderOptions: PathFinderOpts = {
      maxRooms: 1,
    }
    const destination = {
      pos: new RoomPosition(end.x, end.y, room.name),
      range: options?.range ?? 0,
    }

    // 複数の目的地を設定できる？
    const startPosition = new RoomPosition(start.x, start.y, room.name)
    const result = PathFinder.search(startPosition, destination, pathFinderOptions)

    if (result.incomplete === true || result.path.length <= 0) {
      return null
    }

    return RoomPath.createWithRoomPositionPath("TODO", room.name, result.path)
  }
}
