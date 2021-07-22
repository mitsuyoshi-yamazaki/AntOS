import type { RoomAttackedProblem } from "./problem/room/room_attacked_problem"
import type { RoomLostProblem } from "./problem/room/room_lost_problem"
import type { UnexpectedProblem } from "./problem/unexpected/unexpected_problem"

export type AnyTaskProblem = UnexpectedProblem
  | RoomAttackedProblem
  | RoomLostProblem
