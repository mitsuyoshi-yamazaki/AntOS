import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { generateCodename } from "utility/unique_id"

type TestKillScout = {
  readonly case: "kill scout"
}
type TestKillAttacker = {
  readonly case: "kill attacker"
}
type TestTowerDrain = {
  readonly case: "tower drain"
}
type TestSpawnIntercepter = {
  readonly case: "spawn intercepter"
}
type Test = TestKillScout
  | TestKillAttacker
  | TestTowerDrain
  | TestSpawnIntercepter
type TestCase = Test["case"]

type TestResult = {
  readonly testCase: TestCase
  readonly result: string // 人間用
}

ProcessDecoder.register("PurifierProcess", state => {
  return PurifierProcess.decode(state as PurifierProcessState)
})

interface PurifierProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly stopSpawningReasons: string[]
}

export class PurifierProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly stopSpawningReasons: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.targetRoomName}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): PurifierProcessState {
    return {
      t: "PurifierProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: PurifierProcessState): PurifierProcess {
    return new PurifierProcess(
      state.l,
      state.i,
      state.roomName,
      state.targetRoomName,
      state.stopSpawningReasons,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): PurifierProcess {
    return new PurifierProcess(
      Game.time,
      processId,
      roomName,
      targetRoomName,
      [],
    )
  }

  public processShortDescription(): string {
    return `${roomLink(this.targetRoomName)}`
  }

  public runOnTick(): void {
  }
}
