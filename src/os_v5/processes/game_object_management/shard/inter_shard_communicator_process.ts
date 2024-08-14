import { Process, ProcessDependencies, ProcessId, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { RoomName } from "shared/utility/room_name_types"
import { Timestamp } from "shared/utility/timestamp"
import { ValuedArrayMap } from "shared/utility/valued_collection"


/**
# InterShardCommunicatorProcess
## 概要

## メモリ
- 書き込みのみ
  - 部屋数
  - ポータルの場所
- 読み込まれたら削除する
  - SpawnRequest
 */

// TODO: SystemCall経由でアクセスするようにする


type ShardName = string

type V5InterShardMemory = {
  readonly claimedRoomNames: RoomName[]
}

export type InterShardCommunicatorProcessApi = {
  addClaimedRoom(roomName: RoomName): void
  removeClaimedRoom(roomName: RoomName): void

  setPortalPosition(connectedShardName: string): void

  getClaimedRooms(options?: {recheckNow?: true}): Map<string, RoomName[]>
}

// こちら側のShardの記録はProcessStateに記録する：Portalに近い部屋の名前など
type InterShardCommunicatorProcessState = {
  readonly s: ShardName[]                         /// Shard names
  readonly p: { [S: ShardName]: RoomName[] } /// Portal room names
}

ProcessDecoder.register("InterShardCommunicatorProcess", (processId: InterShardCommunicatorProcessId, state: InterShardCommunicatorProcessState) => InterShardCommunicatorProcess.decode(processId, state))

export type InterShardCommunicatorProcessId = ProcessId<void, ProcessDefaultIdentifier, InterShardCommunicatorProcessApi, InterShardCommunicatorProcessState, InterShardCommunicatorProcess>


export class InterShardCommunicatorProcess extends Process<void, ProcessDefaultIdentifier, InterShardCommunicatorProcessApi, InterShardCommunicatorProcessState, InterShardCommunicatorProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private claimedRooms: Readonly<{ rooms: Map<string, RoomName[]>, checkedTimestamp: Timestamp }> | null = null

  private constructor(
    public readonly processId: InterShardCommunicatorProcessId,
    private readonly runningShardNames: ShardName[],
    private readonly portalRoomNames: { [S: ShardName]: RoomName[] },
  ) {
    super()
  }

  public encode(): InterShardCommunicatorProcessState {
    return {
      s: this.runningShardNames,
      p: this.portalRoomNames,
    }
  }

  public static decode(processId: InterShardCommunicatorProcessId, state: InterShardCommunicatorProcessState): InterShardCommunicatorProcess {
    return new InterShardCommunicatorProcess(processId, state.s, state.p)
  }

  public static create(processId: InterShardCommunicatorProcessId): InterShardCommunicatorProcess {
    return new InterShardCommunicatorProcess(processId, [], {})
  }

  public getDependentData(): void {}

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.templateCommand,
    ])
  }

  public run(): InterShardCommunicatorProcessApi {
    return {
      addClaimedRoom: (roomName: RoomName): void => {
      },

      removeClaimedRoom: (roomName: RoomName): void => {
      },

      setPortalPosition: (connectedShardName: string): void => {
        console.log("setPortalPosition() not implemented yet")
      },

      getClaimedRooms: options => this.getClaimedRooms(options?.recheckNow === true),
    }
  }


  // ---- Private ---- //
  private getClaimedRooms(recheckNow: boolean): Map<string, RoomName[]> {
    // if (this.claimedRooms != null) {
    //   if (recheckNow !== true || this.claimedRooms.checkedTimestamp === Game.time) {
    //     return this.claimedRooms.rooms
    //   }
    // }

    // const rooms = new ValuedArrayMap<string, RoomName>()

    // this.runningShardNames.forEach(shardName => {
    //   InterShardMemoryAccessor.getOtherShardMemory(shardName, )
    // })

    // this.claimedRooms = {
    //   rooms,
    //   checkedTimestamp: Game.time,
    // }
    throw "Not implemented yet"
  }


  // ---- Command Runner ---- //
  private readonly templateCommand: Command = {
    command: "template",
    help: (): string => "template {...args}",

    /** @throws */
    run: (): string => {
      return "ok"
    }
  }
}
