import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.registerDecoder("World35872159TestDeclarationProcess", state => {
  return World35872159TestDeclarationProcess.decode(state as World35872159TestDeclarationProcessState)
})

export interface World35872159TestDeclarationProcessState extends ProcessState {
}

export class World35872159TestDeclarationProcess implements Process, Procedural {
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

  public encode(): World35872159TestDeclarationProcessState {
    return {
      t: "World35872159TestDeclarationProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: World35872159TestDeclarationProcessState): World35872159TestDeclarationProcess {
    return new World35872159TestDeclarationProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): World35872159TestDeclarationProcess {
    return new World35872159TestDeclarationProcess(Game.time, processId)
  }

  // public processShortDescription(): string {
  //   const ticksToSpawn = Math.max(attackControllerInterval - (Game.time - this.lastSpawnTime), 0)
  //   return `${ticksToSpawn} to go, ${this.targetRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  // }

  public runOnTick(): void {

  }
}
