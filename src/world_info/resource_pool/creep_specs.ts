import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepRole, mergeRoles } from "prototype/creep_role"
import type { RoomName } from "shared/utility/room_name_types"
import type { CreepTask as V5CreepTask } from "v5_object_task/creep_task/creep_task"
import type { TaskIdentifier } from "v5_task/task"
import { bodyCost } from "utility/creep_body"

/** High未満のpriorityのspawnをキャンセルして優先させる: 未実装 */
type CreepSpawnRequestPriorityUrgent = 0
type CreepSpawnRequestPriorityHigh = 1
type CreepSpawnRequestPriorityMedium = 2
type CreepSpawnRequestPriorityLow = 3

const creepSpawnRequestPriorityUrgent: CreepSpawnRequestPriorityUrgent = 0
const creepSpawnRequestPriorityHigh: CreepSpawnRequestPriorityHigh = 1
const creepSpawnRequestPriorityMedium: CreepSpawnRequestPriorityMedium = 2
const creepSpawnRequestPriorityLow: CreepSpawnRequestPriorityLow = 3

export type CreepSpawnRequestPriority = CreepSpawnRequestPriorityUrgent | CreepSpawnRequestPriorityHigh | CreepSpawnRequestPriorityMedium | CreepSpawnRequestPriorityLow
export const CreepSpawnRequestPriority = {
  Urgent: creepSpawnRequestPriorityUrgent,
  High: creepSpawnRequestPriorityHigh,
  Medium: creepSpawnRequestPriorityMedium,
  Low: creepSpawnRequestPriorityLow,
}

export interface CreepSpawnRequest {
  priority: CreepSpawnRequestPriority
  numberOfCreeps: number
  codename: string

  /** bodyを設定しない場合、rolesから適切なサイズのCreepを生成する */
  roles: CreepRole[]
  body: BodyPartConstant[] | null

  /** 時間経過で消滅する可能性のあるタスクは推奨されない */
  initialTask: V5CreepTask | null
  taskIdentifier: TaskIdentifier | null

  /** 他の部屋へ引き継ぐ場合 */
  parentRoomName: RoomName | null

  name?: string
}

export function mergeRequests(requests: CreepSpawnRequest[]): CreepSpawnRequest[] {
  const result: CreepSpawnRequest[] = []
  const checkedIndexes: number[] = []

  requests.forEach((request, i) => {
    if (checkedIndexes.includes(i) === true) {
      return
    }

    if (request.body != null) {
      result.push(request)
      checkedIndexes.push(i)
      return
    }
    if (i >= requests.length - 1) {
      result.push(request)
      checkedIndexes.push(i)
      return
    }

    checkedIndexes.push(i)

    let mergedRequest: CreepSpawnRequest | null = null
    for (let j = i + 1; j < requests.length; j += 1) {
      if (checkedIndexes.includes(j) === true) {
        continue
      }
      const compareRequest = requests[j]
      if (compareRequest == null) {
        continue
      }

      const requestToMerge = mergedRequest ?? request
      const mergeResult = mergeRequest(requestToMerge, compareRequest)
      if (mergeResult != null) {
        mergedRequest = mergeResult
        checkedIndexes.push(j)
      }
    }
    result.push(mergedRequest ?? request)
  })

  return result
}

function mergeRequest(request1: CreepSpawnRequest, request2: CreepSpawnRequest): CreepSpawnRequest | null {
  if (request1.body != null || request2.body != null || request1.initialTask != null || request2.initialTask != null) {
    return null
  }
  // eslint-disable-next-line eqeqeq
  if (request1.taskIdentifier != request2.taskIdentifier) {
    return null
  }
  // eslint-disable-next-line eqeqeq
  if (request1.parentRoomName != request2.parentRoomName) {
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
    taskIdentifier: request1.taskIdentifier,
    parentRoomName: request1.parentRoomName,
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

/** @deprecated */
export function createBodyFrom(roles: CreepRole[], energyCapacityAvailable: number): BodyPartConstant[] {
  if (roles.includes(CreepRole.Scout) === true) {
    return [MOVE]
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
    const count = Math.min(Math.floor(energyCapacityAvailable / bodyCost(body)), max)
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
    if (energyCapacityAvailable >= bodyCost(defaultBody)) {
      return defaultBody
    }
    return [MOVE, CLAIM]
  }

  PrimitiveLogger.fatal(`Can't construct creep body from role ${roles}`)
  return [MOVE]
}
