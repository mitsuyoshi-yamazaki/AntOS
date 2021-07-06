import { TaskRunnerIdentifier } from "objective/task_runner"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepRole, mergeRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { CreepTask, CreepTaskState, decodeCreepTaskFromState } from "object_task/creep_task/creep_task"

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

export interface CreepSpawnRequestState {
  /** priority */
  p: CreepSpawnRequestPriority

  /** number of creeps */
  n: number

  /** codename */
  c: string

  /** roles */
  r: CreepRole[]

  /** body */
  b: BodyPartConstant[] | null

  /** initial task state */
  it: CreepTaskState | null

  /** task runner identifier */
  i: TaskRunnerIdentifier | null

  /** parent room name */
  pr: RoomName | null
}

export interface CreepSpawnRequest {
  priority: CreepSpawnRequestPriority
  numberOfCreeps: number
  codename: string

  /** bodyを設定しない場合、rolesから適切なサイズのCreepを生成する */
  roles: CreepRole[]
  body: BodyPartConstant[] | null

  /** 時間経過で消滅する可能性のあるタスクは推奨されない */
  initialTask: CreepTask | null
  taskRunnerIdentifier: TaskRunnerIdentifier | null

  /** 他の部屋へ引き継ぐ場合 */
  parentRoomName: RoomName | null
}

export function encodeCreepSpawnRequest(request: CreepSpawnRequest): CreepSpawnRequestState {
  return {
    p: request.priority,
    n: request.numberOfCreeps,
    c: request.codename,
    r: request.roles,
    b: request.body,
    it: request.initialTask?.encode() ?? null,
    i: request.taskRunnerIdentifier,
    pr: request.parentRoomName,
  }
}

export function decodeCreepSpawnRequest(state: CreepSpawnRequestState): CreepSpawnRequest {
  const initialTask = ((): CreepTask | null => {
    if (state.it == null) {
      return null
    }
    return decodeCreepTaskFromState(state.it)
  })()
  return {
    priority: state.p,
    numberOfCreeps: state.n,
    codename: state.c,
    roles: state.r,
    body: state.b,
    initialTask,
    taskRunnerIdentifier: state.i,
    parentRoomName: state.pr,
  }
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
      if (checkedIndexes.includes(j) === true) {
        continue
      }

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
    taskRunnerIdentifier: request1.taskRunnerIdentifier,
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
