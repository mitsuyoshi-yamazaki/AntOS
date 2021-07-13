export interface CreepTaskAssignTaskRequest {
  taskRequestType: "creep task assign"
  // TODO:
}

export interface SpawnCreepTaskRequest {
  taskRequestType: "spawn creep"
  // TODO:
}

export interface RenewCreepTaskRequest {
  taskRequestType: "renew creep"
}

export interface TowerActionTaskRequest {
  taskRequestType: "tower action"
  // TODO:
}

export type SpawnTaskRequest = SpawnCreepTaskRequest | RenewCreepTaskRequest
export type TaskRequest = SpawnTaskRequest | TowerActionTaskRequest
export const TaskRequest = {
  CreepTaskAssign(): CreepTaskAssignTaskRequest {
    return {
      taskRequestType: "creep task assign",
    }
  },

  SpawnCreep(): SpawnCreepTaskRequest {
    return {
      taskRequestType: "spawn creep",
    }
  },

  RenewCreep(): RenewCreepTaskRequest {
    return {
      taskRequestType: "renew creep",
    }
  },

  TowerAction(): TowerActionTaskRequest {
    return {
      taskRequestType: "tower action",
    }
  },
}
