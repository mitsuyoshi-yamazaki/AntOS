import { Process, ProcessDependencies, ProcessId, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { RoomName } from "shared/utility/room_name_types"

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

type InterShardCommunicatorProcessApi = {
  addClaimedRoom(roomName: RoomName): void
  removeClaimedRoom(roomName: RoomName): void

  setPortalPosition(connectedShardName: string): void
}

// こちら側のShardの記録：Portalに近い部屋の名前など
type InterShardCommunicatorProcessState = {
  //
}

ProcessDecoder.register("InterShardCommunicatorProcess", (processId: InterShardCommunicatorProcessId, state: InterShardCommunicatorProcessState) => InterShardCommunicatorProcess.decode(processId, state))

export type InterShardCommunicatorProcessId = ProcessId<void, ProcessDefaultIdentifier, InterShardCommunicatorProcessApi, InterShardCommunicatorProcessState, InterShardCommunicatorProcess>


export class InterShardCommunicatorProcess extends Process<void, ProcessDefaultIdentifier, InterShardCommunicatorProcessApi, InterShardCommunicatorProcessState, InterShardCommunicatorProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: InterShardCommunicatorProcessId,
  ) {
    super()
  }

  public encode(): InterShardCommunicatorProcessState {
    return {
    }
  }

  public static decode(processId: InterShardCommunicatorProcessId, state: InterShardCommunicatorProcessState): InterShardCommunicatorProcess {
    return new InterShardCommunicatorProcess(processId)
  }

  public static create(processId: InterShardCommunicatorProcessId): InterShardCommunicatorProcess {
    return new InterShardCommunicatorProcess(processId)
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
    }
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
