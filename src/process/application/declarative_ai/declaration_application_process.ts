import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { CreepName } from "prototype/creep"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { OperatingSystem } from "os/os"
import { MessageObserver } from "os/infrastructure/message_observer"
import { } from "./declaration/declaration"
import { DeclarationState } from "./declaration/declaration_state"
import { } from "./declaration/declaration_maker"

ProcessDecoder.register("DeclarationApplicationProcess", state => {
  return DeclarationApplicationProcess.decode(state as DeclarationApplicationProcessState)
})

interface DeclarationApplicationProcessState extends ProcessState {
  readonly declarationStates: DeclarationState[]
}

export class DeclarationApplicationProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.identifier = this.constructor.name
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DeclarationApplicationProcessState {
    return {
      t: "DeclarationApplicationProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: DeclarationApplicationProcessState): DeclarationApplicationProcess {
    return new DeclarationApplicationProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): DeclarationApplicationProcess {
    return new DeclarationApplicationProcess(Game.time, processId)
  }

  // public processShortDescription(): string {
  // }

  public didReceiveMessage(message: string): string {

  }

  public runOnTick(): void {

  }
}
