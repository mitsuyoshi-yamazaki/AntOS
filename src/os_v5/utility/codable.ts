export interface State {
  readonly t: string
}

export interface Codable {
  encode(): State
}
