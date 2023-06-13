/**
# 要件
- 自由に実行中の処理の関係性を可視化する
  - ソフトウェア上の概念をリレーションで接続する
    - それぞれの概念、リレーションは自己説明的になっている

# 仕様
- Idea: Subject, Objectの基底クラス
  - Ideaは文字通りSubject, Objectになりうるもの。各種ゲームオブジェクト、プロセス、アルゴリズム等

## 制約
- Idea, Relationを動的に型ガードできる必要
 */

abstract class Idea {
  public abstract readonly ideaType: string
  public readonly targetedBy: Relation<Idea>[] = []

  public abstract static guard(arg: Idea): arg is Idea
}

class Relation<T extends Idea> {
  public constructor(
    public readonly item: T,
  ) {
  }
}

class BidirectionalRelation<Subject extends Idea, Obj extends Idea> extends Relation<Obj> {
  public constructor(
    public readonly subject: Subject,
    item: Obj,
  ) {
    super(item)
    item.targetedBy.push(this)
  }

  public dealloc(): void {
    const index = this.item.targetedBy.indexOf(this)
    if (index < 0) {
      throw `${this} is already deallocated from ${this.item}`
    }
    this.item.targetedBy.splice(index, 1)
  }
}

// ---- ---- //
abstract class GameObject extends Idea {
}

// ---- Structure ---- //
type EnergyStore = {
  energy: number
}

class Spawn extends GameObject {
  public readonly ideaType: "spawn"

  public readonly store: EnergyStore = {
    energy: 0,
  }

  public static guard(arg: Idea): arg is Spawn {
    return arg.ideaType === "spawn"
  }
}

class Extension extends GameObject {
  public readonly ideaType: "extension"

  public readonly store: EnergyStore = {
    energy: 0,
  }

  public static guard(arg: Idea): arg is Extension {
    return arg.ideaType === "extension"
  }
}

type EnergyStorage = Spawn | Extension

// ---- Action ---- //
class CreepAction<Obj extends GameObject> extends BidirectionalRelation<Creep, Obj> {
}

class TransferEnergyAction extends CreepAction<EnergyStorage> {
}

// ---- Creep ---- //
class Creep extends GameObject {
  public readonly ideaType: "creep"

  public static guard(arg: Idea): arg is Creep {
    return arg.ideaType === "creep"
  }
}

type HaulerActions = TransferEnergyAction

class Hauler extends Creep {
  readonly actions: HaulerActions[] = []
}

const extension: Idea = ...;

if (Creep.guard(extension)) {
  extension
}

const hoge = extension.targetedBy.filter()
