export class CreepBody {
  public readonly bodyParts: BodyPartConstant[]

  // public constructor(bodyDefinition: string)
  public constructor(bodyParts: BodyPartConstant[]) {
  // public constructor(args: string | BodyPartConstant[]) { // TODO:
    this.bodyParts = bodyParts
  }
}
