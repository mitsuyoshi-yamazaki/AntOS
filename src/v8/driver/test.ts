type SingleResourceIdentifier<T> = Id<T>
type SharedResourceIdentifier = string

/**
 * - 仮想化した資源
 */
interface GameResource<Identifier> {
  readonly case: "single" | "shared"
  readonly identifier: Identifier
}
interface SingleGameResource<T> extends GameResource<SingleResourceIdentifier<T>> {
  readonly case: "single"
  readonly identifier: SingleResourceIdentifier<T>
}
interface SharedGameResource<ChildResources> extends GameResource<SharedResourceIdentifier> {
  readonly case: "shared"
  readonly identifier: SharedResourceIdentifier
  readonly childResources: ChildResources
}

class CreepResource implements SingleGameResource<Creep> {
  public readonly case = "single"

  public constructor(
    public readonly identifier: Id<Creep>,
  ) {
  }
}

class HaulerTask {

}

/**
 * - ドライバに置くということはプロセスからは手が出ないということ
 *   - → それで良いのか？
 *     - → 環境が異なる場合に挙動を変えられた方が良いということを考えるとプロセスの責任範囲では
 */
class HaulerResource implements SharedGameResource<Array<CreepResource>> {
  public readonly case = "shared"

  public constructor(
    public readonly identifier: SharedResourceIdentifier,
    public readonly childResources: CreepResource[],
  ) {
  }

  public addTasks(tasks: HaulerTask[]): void {
    // 不足分のCreepをどのようにspawnする？
  }

  public addCreep(creepResource: CreepResource): void {
    this.childResources.push(creepResource)
  }
}

class CreepManagerProcess {

}
