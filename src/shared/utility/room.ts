import { isMyController, MyController } from "./structure_controller"

export type MyRoom = Room & {
  readonly controller: MyController
}

export const isMyRoom = (room: Room): room is MyRoom => room.controller != null && isMyController(room.controller)
