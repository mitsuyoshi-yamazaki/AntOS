export type RoomName = string

export interface RoomPathMemory {
  /** source paths */
  s: {
    /** source ID */
    [index: string]: {
      /** path */
      p: {
        x: number,
        y: number,
      }[]

      /** destination */
      d: {
        x: number,
        y: number,
      }
    } | "no path"
  }
}
