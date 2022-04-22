import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type SignApiWrapperResult = FINISHED | IN_PROGRESS | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR

export interface SignApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<StructureController>

  /** sign text */
  s: string
}

export class SignApiWrapper implements ApiWrapper<Creep, SignApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "sign"
  public readonly range = 1

  private constructor(
    public readonly target: StructureController,
    private readonly text: string,
  ) {
  }

  public encode(): SignApiWrapperState {
    return {
      t: "SignApiWrapper",
      i: this.target.id,
      s: this.text,
    }
  }

  public static decode(state: SignApiWrapperState): SignApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new SignApiWrapper(target, state.s)
  }

  public static create(target: StructureController, text: string): SignApiWrapper {
    return new SignApiWrapper(target, text)
  }

  public run(creep: Creep): SignApiWrapperResult {
    const result = creep.signController(this.target, this.text)

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`SignApiWrapper received ${result}, ${creep.name} in ${roomLink(creep.room.name)}, target: ${this.target}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
