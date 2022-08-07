import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { UniqueId } from "utility/unique_id"
import { coloredText, roomLink } from "utility/log"
import { MessageObserver } from "os/infrastructure/message_observer"
import { InterShardMemoryObserver, InterShardMemoryWatcher, ShardMemoryRequest } from "utility/inter_shard_memory"

ProcessDecoder.register("IntershardResourceReceiverProcess", state => {
  return IntershardResourceReceiverProcess.decode(state as IntershardResourceReceiverProcessState)
})

interface IntershardResourceReceiverProcessState extends ProcessState {
  readonly identifier: string
  readonly roomName: RoomName
  readonly portalRoomName: RoomName
  readonly targetShardName: string
}

export class IntershardResourceReceiverProcess implements Process, Procedural, MessageObserver, InterShardMemoryObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,

    /// IntershardResourceTransferProcessと共通のidentifierでCreepを共用する
    public readonly identifier: string,
    private readonly roomName: RoomName,
    private readonly portalRoomName: RoomName,
    private readonly targetShardName: string,
  ) {
    this.codename = UniqueId.generateCodename(this.identifier, this.launchTime)

    InterShardMemoryWatcher?.registerObserver(this, targetShardName, "creep")
  }

  public encode(): IntershardResourceReceiverProcessState {
    return {
      t: "IntershardResourceReceiverProcess",
      l: this.launchTime,
      i: this.processId,
      identifier: this.identifier,
      roomName: this.roomName,
      portalRoomName: this.portalRoomName,
      targetShardName: this.targetShardName,
    }
  }

  public static decode(state: IntershardResourceReceiverProcessState): IntershardResourceReceiverProcess {
    return new IntershardResourceReceiverProcess(
      state.l,
      state.i,
      state.identifier,
      state.roomName,
      state.portalRoomName,
      state.targetShardName,
    )
  }

  public static create(processId: ProcessId, identifier: string, roomName: RoomName, portalRoomName: RoomName, targetShardName: string): IntershardResourceReceiverProcess {
    return new IntershardResourceReceiverProcess(
      Game.time,
      processId,
      identifier,
      roomName,
      portalRoomName,
      targetShardName,
    )
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)} =&gt portal ${roomLink(this.portalRoomName)}`
    ]

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.processShortDescription()

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public didReceiveRemoteShardRequest(request: ShardMemoryRequest, shard: string): void {
    if (request.case !== "creep") {
      return
    }

    console.log(`${coloredText("[Inter Shard Request]", "info")} received creep request from ${shard}, creeps: ${request.creeps.map(creep => creep.name).join(",")}`)
  }

  public runOnTick(): void {

  }
}
