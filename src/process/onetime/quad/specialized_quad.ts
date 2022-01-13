import { CreepName } from "prototype/creep"
import { RoomName } from "utility/room_name"

export type QuadDirection = TOP | BOTTOM | LEFT | RIGHT
export type QuadAttackTargetType = AnyCreep | AnyStructure

export interface QuadInterface {
  // ---- Property ---- //
  numberOfCreeps: number
  pos: RoomPosition
  room: Room
  damage: number
  damagePercent: number
  minTicksToLive: number

  // ---- Position ---- //
  inRoom(roomName: RoomName): boolean
  allCreepsInSameRoom(): boolean
  getMinRangeTo(position: RoomPosition): number
  getMaxRangeTo(position: RoomPosition): number
  isQuadForm(): boolean

  // ---- Member ---- //
  addCreep(creep: Creep): void
  includes(creepName: CreepName): boolean

  // ---- Action ---- //
  say(message: string): void

  // ---- Move ---- //
  moveToRoom(destinationRoomName: RoomName, waypoints: RoomName[], options?: { quadFormed?: boolean, wait?: boolean }): void
  moveTo(position: RoomPosition, range: number): void
  fleeFrom(position: RoomPosition, range: number): void
  keepQuadForm(): void

  // ---- Attack ---- //
  heal(targets?: AnyCreep[]): void
  attack(mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[], noCollateralDamage: boolean): void
  passiveAttack(targets: QuadAttackTargetType[], noCollateralDamage: boolean): void

  // ---- Execution ---- //
  beforeRun(): void
  run(): void

  setDirection(direction: QuadDirection): void
}
