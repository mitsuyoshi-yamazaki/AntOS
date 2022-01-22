export type ProblemIdentifier = string

export interface Problem {
  identifier: ProblemIdentifier
  shouldNotify: boolean
}
