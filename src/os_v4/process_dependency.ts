import { RoomName } from "shared/utility/room_name_types"

export type ProcessDependency<T extends string, I> = {
  readonly typeSpecifier: T
  readonly identifier: I
}

export type ProcessDependencyNone = ProcessDependency<"none", "none">

export type RoomResource = ProcessDependency<"room_resource", RoomName> & {
  readonly room: Room
}

export type AnyProcessDependency = RoomResource
export type ProcessDependencyType = AnyProcessDependency["typeSpecifier"]

export type GenericProcessDependency<ProcessDependencyType> = ProcessDependencyType extends "room_resource" ? RoomResource : ProcessDependencyNone

export type ProcessDependencySet<T extends AnyProcessDependency> = Readonly<{ [S in T["typeSpecifier"]]: GenericProcessDependency<S>}>
