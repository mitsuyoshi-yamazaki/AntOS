import { GameObjectTask } from "game_object_task/game_object_task"

export type CreepName = string

declare global {
  interface Creep {
    task: GameObjectTask<Creep> | null
  }
}

interface Creep {
  _task: GameObjectTask<Creep> | null
}

export function init(): void {
  Object.defineProperty(Creep.prototype, "task", {
    get(): GameObjectTask<Creep> | null {
      return this._task
    },
    set(task: GameObjectTask<Creep> | null): void {
      this._task = task
    }
  })
}
