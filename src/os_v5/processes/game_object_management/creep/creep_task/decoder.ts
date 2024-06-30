import { SerializableObject } from "os_v5/utility/types"
import { AnyTask, TaskState, taskTypeDecodingMap, TaskTypes } from "./types"
import { Tasks } from "./tasks/tasks"


export const decode = (state: TaskState): AnyTask | null => {
  const taskType = taskTypeDecodingMap[state.t]
  const decoder = decoders[taskType]
  return decoder(state)
}


const decoders: { [K in TaskTypes]: (state: SerializableObject) => AnyTask | null } = {
  // Primitive
  HarvestEnergy: state => Tasks.HarvestEnergy.decode(state as ReturnType<Tasks.HarvestEnergy["encode"]>),
  ClaimController: state => Tasks.ClaimController.decode(state as ReturnType<Tasks.ClaimController["encode"]>),
  UpgradeController: state => Tasks.UpgradeController.decode(state as ReturnType<Tasks.UpgradeController["encode"]>),
  WithdrawResource: state => Tasks.WithdrawResource.decode(state as ReturnType<Tasks.WithdrawResource["encode"]>),

  // Move
  MoveTo: state => Tasks.MoveTo.decode(state as ReturnType<Tasks.MoveTo["encode"]>),
  MoveToRoom: state => Tasks.MoveToRoom.decode(state as ReturnType<Tasks.MoveToRoom["encode"]>),

  // Combined
  Sequential: state => {
    const sequentialState = state as ReturnType<Tasks.Sequential["encode"]>
    const childTasks = sequentialState.c.flatMap(childState => {
      const task = decode(childState as TaskState)
      return task == null ? [] : [task]
    })
    return Tasks.Sequential.create(childTasks, sequentialState.i)
  },

  // Wrapper
  TargetRoomObject: state => Tasks.TargetRoomObject.decode(state as ReturnType<Tasks.TargetRoomObject["encode"]>),
}
