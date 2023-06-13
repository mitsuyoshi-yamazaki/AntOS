type Idea = {
  readonly targetedBy: Relation<Idea>[]
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
abstract class GameObject implements Idea {
  public readonly targetedBy: Relation<Idea>[] = []
}

// ---- Structure ---- //
type EnergyStore = {
  energy: number
}

class Spawn extends GameObject {
  readonly store: EnergyStore = {
    energy: 0,
  }
}

class Extension extends GameObject {
  readonly store: EnergyStore = {
    energy: 0,
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
}

type HaulerActions = TransferEnergyAction

class Hauler extends Creep {
  readonly actions: HaulerActions[] = []
}
