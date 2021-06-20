export type ProcessId = number

export interface PriorityInformation {
  // TODO: 何に役に立つのか判断するのに使える情報
  // n tick後にどのくらいの利益が見込めるか
}

export interface ProcessRequirement {
  // プロセス実行時に要求される内容を格納する予約interface
}

export interface ProcessResult {
  // プロセス実行結果を格納する予約interface
}

// ---- Type of Process ---- //
export interface Process {
  processId: ProcessId
  shouldStore: boolean
}

export interface StatefulProcess extends Process {
  // !!!! UPDATE isStatefulProcess() !!!! //
  shouldStore: true
  encode(): unknown
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isStatefulProcess(arg: any): arg is StatefulProcess {
  return arg.shouldStore === true && arg.encode !== undefined
}

// ---- Type of Execution ---- //
export interface Procedural {
  runOnTick(): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isProcedural(arg: any): arg is Procedural {
  return arg.runOnTick !== undefined
}

export interface EventDriven {
  // TODO:
}
