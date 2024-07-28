import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ProcessDefaultIdentifier } from "os_v5/process/process"
import { EmptySerializable } from "shared/utility/serializable_types"
import { getPositionSpecifier, Position } from "shared/utility/position_v2"
import { RoomName } from "shared/utility/room_name_types"
import { ValuedMapMap } from "shared/utility/valued_collection"


type PositionSpecifier = string

export type TerrainCacheProcessApi = {
  getTerrainAtPosition(position: Position, room: Room): Terrain
}


ProcessDecoder.register("TerrainCacheProcess", (processId: TerrainCacheProcessId) => TerrainCacheProcess.decode(processId))

export type TerrainCacheProcessId = ProcessId<void, ProcessDefaultIdentifier, TerrainCacheProcessApi, EmptySerializable, TerrainCacheProcess>


export class TerrainCacheProcess extends Process<void, ProcessDefaultIdentifier, TerrainCacheProcessApi, EmptySerializable, TerrainCacheProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  // private readonly accessLog = new ValuedArrayMap<RoomName, Timestamp>() // TODO: キャッシュのクリア // キャッシュ不要な部屋についてはオプションできるようにする
  private readonly terrainCache = new ValuedMapMap<RoomName, PositionSpecifier, Terrain>()

  private constructor(
    public readonly processId: TerrainCacheProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: TerrainCacheProcessId): TerrainCacheProcess {
    return new TerrainCacheProcess(processId)
  }

  public static create(processId: TerrainCacheProcessId): TerrainCacheProcess {
    return new TerrainCacheProcess(processId)
  }

  public getDependentData(): void {}

  public staticDescription(): string {
    return "TODO"
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): TerrainCacheProcessApi {
    return {
      getTerrainAtPosition: (position: Position, room: Room): Terrain => {  // TODO: Structure考慮
        const specifier = getPositionSpecifier(position)
        const cached = this.terrainCache.getValueFor(room.name).get(specifier)
        if (cached != null) {
          return cached
        }

        const terrain = room.lookForAt(LOOK_TERRAIN, position.x, position.y)[0] ?? "plain"
        this.terrainCache.getValueFor(room.name).set(specifier, terrain)
        return terrain
      },
    }
  }


  // Private
}
