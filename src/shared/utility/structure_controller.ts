export type MyController = StructureController & {
  readonly my: true
}

export const isMyController = (controller: StructureController): controller is MyController => controller.my === true
