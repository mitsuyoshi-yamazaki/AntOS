import { SerializableObject } from "os_v5/utility/types"
import { AnyTask, TaskState, taskTypeDecodingMap, TaskTypes } from "./types"
import { Tasks } from "./tasks/tasks"


export const decode = (state: TaskState): AnyTask => {
  const taskType = taskTypeDecodingMap[state.t]
  const decoder = decoders[taskType]
  return decoder(state)
}


const decoders: { [K in TaskTypes]: (state: SerializableObject) => AnyTask } = {
  // Primitive
  MoveTo: state => Tasks.MoveTo.decode(state as ReturnType<Tasks.MoveTo["encode"]>),
  HarvestEnergy: state => Tasks.HarvestEnergy.decode(state as ReturnType<Tasks.HarvestEnergy["encode"]>),

  // Combined
  Sequential: state => {
    const sequentialState = state as ReturnType<Tasks.Sequential["encode"]>
    const childTasks = sequentialState.c.map(childState => decode(childState as TaskState))
    return Tasks.Sequential.create(childTasks, sequentialState.i)
  },
}
