type Declarative = {
  readonly description: string
  describe(): string
}

type Obj = Declarative & {
  readonly case: "object"
  targetedBy: TransitiveAction<Obj>[]
}

type Action = Declarative & {
  subject: Subject<AnyAction> // FixMe: readonlyにしたい
}
type TransitiveAction<O extends Obj> = Action & {
  readonly case: "transitive action"
  object: O
}
type IntransitiveAction = Action & {
  readonly case: "intransitive action"
  //
}
type AnyAction = TransitiveAction<Obj> | IntransitiveAction

abstract class Subject<Actions extends AnyAction> implements Declarative {
  readonly case: "subject"
  readonly actionsInProgress: Actions[]

  abstract readonly description: string

  public describe(): string {
    if (this.actionsInProgress.length <= 0) {
      return `- ${this.description} is doing nothing`
    }
    const descriptions: string[] = [
      `- ${this.description} is`,
      ...this.actionsInProgress.map(action => `  - ${action.describe()}`),
    ]

    return descriptions.join("\n")
  }

  public run(action: Actions): void {
    action.subject = this
    this.actionsInProgress.push(action)
  }
}

/**
- 行いたいこと
  - 採掘効率化
  - Spawn効率化
  - 移動効率化
 */
