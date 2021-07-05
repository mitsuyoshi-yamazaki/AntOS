import { TaskRunnerIdentifier } from "objective/task_runner"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepRole, mergeRoles } from "prototype/creep_role"
import { CreepTask } from "task/creep_task/creep_task"

/** High未満のpriorityのspawnをキャンセルして優先させる */
type CreepSpawnRequestPriorityUrgent = 0
type CreepSpawnRequestPriorityHigh = 1
type CreepSpawnRequestPriorityMedium = 2
type CreepSpawnRequestPriorityLow = 3

export const creepSpawnRequestPriorityUrgent: CreepSpawnRequestPriorityUrgent = 0
export const creepSpawnRequestPriorityHigh: CreepSpawnRequestPriorityHigh = 1
export const creepSpawnRequestPriorityMedium: CreepSpawnRequestPriorityMedium = 2
export const creepSpawnRequestPriorityLow: CreepSpawnRequestPriorityLow = 3

export type CreepSpawnRequestPriority = CreepSpawnRequestPriorityUrgent | CreepSpawnRequestPriorityHigh | CreepSpawnRequestPriorityMedium | CreepSpawnRequestPriorityLow

export interface CreepSpawnRequest {
  priority: CreepSpawnRequestPriority
  numberOfCreeps: number
  codename: string

  /** bodyを設定しない場合、rolesから適切なサイズのCreepを生成する */
  roles: CreepRole[]
  body: BodyPartConstant[] | null

  initialTask: CreepTask | null
  taskRunnerIdentifier: TaskRunnerIdentifier | null
}

export function mergeRequests(requests: CreepSpawnRequest[]): CreepSpawnRequest[] {
  const result: CreepSpawnRequest[] = []
  const checkedIndexes: number[] = []

  for (let i = 0; i < requests.length; i += 1) {
    if (checkedIndexes.includes(i) === true) {
      continue
    }

    const request = requests[i]
    if (request.body != null) {
      result.push(request)
      checkedIndexes.push(i)
      continue
    }
    if (i >= requests.length - 1) {
      result.push(request)
      checkedIndexes.push(i)
      continue
    }

    checkedIndexes.push(i)

    let mergedRequest: CreepSpawnRequest | null = null
    for (let j = i + 1; j < requests.length; j += 1) {
      const requestToMerge = mergedRequest ?? request
      const mergeResult = mergeRequest(requestToMerge, requests[j])
      if (mergeResult != null) {
        mergedRequest = mergeResult
        checkedIndexes.push(j)
      }
    }
    result.push(mergedRequest ?? request)
  }

  return result
}

function mergeRequest(request1: CreepSpawnRequest, request2: CreepSpawnRequest): CreepSpawnRequest | null {
  if (request1.body != null || request2.body != null || request1.initialTask != null || request2.initialTask != null) {
    return null
  }
  // eslint-disable-next-line eqeqeq
  if (request1.taskRunnerIdentifier != request2.taskRunnerIdentifier) {
    return null
  }

  const roles = mergeRoles(request1.roles, request2.roles)
  if (roles == null) {
    return null
  }

  const prioritizedRequest = request1.priority <= request2.priority ? request1 : request2
  return {
    priority: prioritizedRequest.priority,
    numberOfCreeps: request1.numberOfCreeps >= request2.numberOfCreeps ? request1.numberOfCreeps : request2.numberOfCreeps,
    codename: prioritizedRequest.codename,
    roles,
    body: null,
    initialTask: null,
    taskRunnerIdentifier: request1.taskRunnerIdentifier,
  }
}

export function sortRequests(requests: CreepSpawnRequest[]): CreepSpawnRequest[] {
  return requests.sort((lhs, rhs): number => {
    if (lhs.priority !== rhs.priority) {
      return lhs.priority < rhs.priority ? -1 : 1
    }
    return lhs.numberOfCreeps > rhs.numberOfCreeps ? -1 : 1 // TODO: body.lengthも考慮して優先度をつける
  })
}

export function createBodyFrom(roles: CreepRole[], energyCapacityAvailable: number): BodyPartConstant[] {
  if (roles.includes(CreepRole.Scout) === true) {
    return [MOVE]
  }

  const cost = (body: BodyPartConstant[]): number => {
    return body.reduce((result, current) => {
      return result + BODYPART_COST[current]
    }, 0)
  }

  const appendMove = ((body: BodyPartConstant[]): BodyPartConstant[] => {
    if (roles.includes(CreepRole.Mover) === true) {
      const length = body.length
      for (let i = 0; i < length; i += 1) {
        body.push(MOVE)
      }
    }
    return body
  })

  const multiply = (body: BodyPartConstant[], max: number): BodyPartConstant[] => {
    const count = Math.min(Math.floor(energyCapacityAvailable / cost(body)), max)
    const result: BodyPartConstant[] = []
    for (let i = 0; i < count; i += 1) {
      result.push(...body)
    }
    return result
  }

  if (roles.includes(CreepRole.Worker) === true) {
    return multiply(appendMove([WORK, CARRY]), 3)
  }
  if (roles.includes(CreepRole.Harvester) === true) {
    return multiply(appendMove([WORK, WORK, CARRY]), 3)
  }
  if (roles.includes(CreepRole.Hauler) === true) {
    return multiply(appendMove([CARRY]), 10)
  }
  if (roles.includes(CreepRole.EnergyStore) === true) { // ??
    return multiply(appendMove([CARRY]), 10)
  }
  if (roles.includes(CreepRole.Claimer) === true) {
    const defaultBody = [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM]
    if (energyCapacityAvailable >= cost(defaultBody)) {
      return defaultBody
    }
    return [MOVE, CLAIM]
  }

  PrimitiveLogger.fatal(`Can't construct creep body from role ${roles}`)
  return [MOVE]
}
