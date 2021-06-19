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

export interface Process {
  parentProcessId: ProcessId
  priority: PriorityInformation

  run(requirement: ProcessRequirement): ProcessResult
  // currentState(): JSON // TODO:
}
