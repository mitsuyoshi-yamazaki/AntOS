// type ResourceConstant = string

// // --

// type Obj = {
//   targetedBy: TransitiveAction<Obj>[]
// }
// type TransitiveAction<O extends Obj> = {
//   object: O
// }
// type IntransitiveAction = {
//   //
// }
// type AnyAction = TransitiveAction<Obj> | IntransitiveAction
// type Subject<Actions extends AnyAction> = {
//   readonly actionsInProgress: Actions[]
// }

// type Storable = Obj & {
//   //
// }

// class Extension implements Storable {
//   targetedBy: TransitiveAction<Obj>[] = []
// }

// type EnergyStore = Extension

// type MoveAndTransferAction<T extends Storable> = TransitiveAction<T> & {
//   readonly resourceTypes: ResourceConstant[]
// }

// class Hauler implements Obj, Subject<MoveAndTransferAction<EnergyStore>> {
//   targetedBy: TransitiveAction<Obj>[] = []

//   readonly actionsInProgress: MoveAndTransferAction<EnergyStore>[] = []
// }

// type FillEnergySourceAction<T extends Storable> = TransitiveAction<T> & {
//   readonly resourceTypes: ResourceConstant[]
// }

// class HaulerSquad implements Object, Subject<MoveAndTransferAction<EnergyStore>> {
//   // 個々のHaulerのActionと紐づく
//   // どうやって実装する？
// }

