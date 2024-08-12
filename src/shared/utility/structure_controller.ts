import type { MyRoom } from "./room"

export type MyController = StructureController & {
  readonly my: true
  readonly room: MyRoom
}

export const isMyController = (controller: StructureController): controller is MyController => controller.my === true
