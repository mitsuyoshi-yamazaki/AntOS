import { State, Stateful } from "os/infrastructure/state"

export interface ApiWrapperState extends State {
}

export interface ApiWrapper<ObjectType, Result> extends Stateful {
  shortDescription: string

  encode(): ApiWrapperState
  run(obj: ObjectType): Result
}
