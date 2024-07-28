import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ProcessDefaultIdentifier } from "os_v5/process/process"
import { TerrainCacheProcessApi } from "./terrain_cache_process"
import { getPositionSpecifier, Position } from "shared/utility/position_v2"
import { RoomPath, RoomPathState } from "./room_path"
import { RoomName } from "shared/utility/room_name_types"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { strictEntries } from "shared/utility/strict_entries"
import { GameConstants } from "utility/constants"
import { describePosition } from "prototype/room_position"


export type FindPathOptions = {
  shouldCache?: true
  range?: number
  isDestinationPortal?: true
}

export type PathManagerProcessApi = {
  findPath(room: Room, start: Position, end: Position, options?: FindPathOptions): RoomPath | null
  createPath(roomName: RoomName, path: Position[]): RoomPath
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
  private readonly costMatrixCache = new Map<RoomName, CostMatrix>()

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
      createPath: (roomName: RoomName, path: Position[]) => RoomPath.create("TODO", roomName, path),
    }
  }


  // Private
  private findPath(room: Room, start: Position, end: Position, options?: FindPathOptions): RoomPath | null {
    const obstacleCost = GameConstants.pathFinder.costs.obstacle

    const roomCallback = ((): () => CostMatrix => {
      if (options?.isDestinationPortal === true) {
        return (): CostMatrix => {
          const costMatrix = new PathFinder.CostMatrix
          const fixedPositions = new Set<string>()

          room.find(FIND_STRUCTURES).forEach(structure => {
            const positionSpecifier = getPositionSpecifier(structure.pos)
            if (fixedPositions.has(positionSpecifier) === true) {
              return
            }

            switch (structure.structureType) {
            case STRUCTURE_ROAD:
              costMatrix.set(structure.pos.x, structure.pos.y, 1)
              fixedPositions.add(positionSpecifier)
              return
            case STRUCTURE_CONTAINER:
              return
            case STRUCTURE_RAMPART:
              if (structure.my === true) {
                costMatrix.set(structure.pos.x, structure.pos.y, 2)
              } else {
                costMatrix.set(structure.pos.x, structure.pos.y, obstacleCost)
                fixedPositions.add(positionSpecifier)
              }
              return
            case STRUCTURE_PORTAL:
              if (structure.pos.isEqualTo(end.x, end.y) !== true) {
                costMatrix.set(structure.pos.x, structure.pos.y, obstacleCost)
                fixedPositions.add(positionSpecifier)
              }
              return

            default:
              costMatrix.set(structure.pos.x, structure.pos.y, obstacleCost)
              fixedPositions.add(positionSpecifier)
              return
            }
          })

          this.costMatrixCache.set(room.name, costMatrix)
          return costMatrix
        }
      }

      return (): CostMatrix => {
        const cached = this.costMatrixCache.get(room.name)
        if (cached != null) {
          return cached
        }

        const costMatrix = new PathFinder.CostMatrix
        const fixedPositions = new Set<string>()

        room.find(FIND_STRUCTURES).forEach(structure => {
          const positionSpecifier = getPositionSpecifier(structure.pos)
          if (fixedPositions.has(positionSpecifier) === true) {
            return
          }

          switch (structure.structureType) {
          case STRUCTURE_ROAD:
            costMatrix.set(structure.pos.x, structure.pos.y, 1)
            fixedPositions.add(positionSpecifier)
            return
          case STRUCTURE_CONTAINER:
            return
          case STRUCTURE_RAMPART:
            if (structure.my === true) {
              costMatrix.set(structure.pos.x, structure.pos.y, 2)
            } else {
              costMatrix.set(structure.pos.x, structure.pos.y, obstacleCost)
              fixedPositions.add(positionSpecifier)
            }
            return
          default:
            costMatrix.set(structure.pos.x, structure.pos.y, obstacleCost)
            fixedPositions.add(positionSpecifier)
            return
          }
        })

        this.costMatrixCache.set(room.name, costMatrix)
        return costMatrix
      }
    })()

    const pathFinderOptions: PathFinderOpts = {
      plainCost: 2,
      swampCost: 10,
      maxRooms: 1,
      roomCallback,
    }
    const destination = {
      pos: new RoomPosition(end.x, end.y, room.name),
      range: options?.range ?? 0,
    }

    // 複数の目的地を設定できる？
    const startPosition = new RoomPosition(start.x, start.y, room.name)
    const result = PathFinder.search(startPosition, destination, pathFinderOptions)

    console.log(`${room.name} from ${describePosition(start)} to ${describePosition(end)} (incomplete: ${result.incomplete}) path: ${result.path}`) // FixMe:

    if (result.incomplete === true || result.path.length <= 0) {
      return null
    }

    return RoomPath.createWithRoomPositionPath("TODO", room.name, [new RoomPosition(start.x, start.y, room.name), ...result.path])
  }
}
