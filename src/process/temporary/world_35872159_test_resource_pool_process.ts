import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"
import type { RoomName } from "shared/utility/room_name_types"

ProcessDecoder.register("World35872159TestResourcePoolProcess", state => {
  return World35872159TestResourcePoolProcess.decode(state as World35872159TestResourcePoolProcessState)
})

export type ObserveRoomDeclaration = {
  readonly declarationType: "observe room"
  readonly targetRoomName: RoomName
}
export type Declaration = ObserveRoomDeclaration

export type ObserveRoomResource = Creep | StructureObserver

const declarations: Declaration[] = []

export const DeclarationPool = {
  add(declaration: Declaration): void {
    declarations.push(declaration)
  }
}

export interface World35872159TestResourcePoolProcessState extends ProcessState {
}

export class World35872159TestResourcePoolProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): World35872159TestResourcePoolProcessState {
    return {
      t: "World35872159TestResourcePoolProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: World35872159TestResourcePoolProcessState): World35872159TestResourcePoolProcess {
    return new World35872159TestResourcePoolProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): World35872159TestResourcePoolProcess {
    return new World35872159TestResourcePoolProcess(Game.time, processId)
  }

  // public processShortDescription(): string {
  //   const ticksToSpawn = Math.max(attackControllerInterval - (Game.time - this.lastSpawnTime), 0)
  //   return `${ticksToSpawn} to go, ${this.targetRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  // }

  public runOnTick(): void {
    /**
     * - observeはobserverを使う方式とscoutを派遣する方式のふたつがあり、どちらを採用すべきかはProcessからはわからないため、resource poolまで"observe declaration"を渡す
     */
  }
}
