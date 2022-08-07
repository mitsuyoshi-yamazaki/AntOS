type IntraShardPortal = Omit<StructurePortal, "destination"> & { destination: RoomPosition }
type InterShardPortal = Omit<StructurePortal, "destination"> & { destination: { shard: string, room: string } }
type Portal = IntraShardPortal | InterShardPortal

export const isIntraShardPortal = (portal: Portal): portal is IntraShardPortal => {
  return portal.destination instanceof RoomPosition
}

const _isIntraShardPortal = (portal: InterShardPortal | IntraShardPortal): portal is IntraShardPortal => {
  return portal.destination instanceof RoomPosition
}

function doSomething(portal: StructurePortal): void {
  portal.destination
  if (isIntraShardPortal(portal as Portal)) {
    portal.destination // destination is `RoomPosition` (as expected
  } else {
    portal.destination // destination is `RoomPosition | {shard: string, room: string}`
  }
}


type A = { destination: RoomPosition }
type B = { destination: { shard: string, room: string } }
type AB<T extends StructurePortal> = T extends A ? A : B
interface C { a: string | number }
type D = { destination: RoomPosition } | { destination: { shard: string, room: string } }

function aaa(a: D): void {

}

function aaaa(portal: StructurePortal): void {
  const ab: AB<StructurePortal> = portal
  const c: C = portal
  const d: D = portal
}


// type Hoge = string | number
// function isString(hoge: Hoge): hoge is string {
//   return true
// }

// function fuga(hoge: Hoge): void {
//   if (isString(hoge)) {
//     hoge.
//   } else {
//     hoge.
//   }
// }

function isInterShardPortal(portalDestination: StructurePortal["destination"]): portalDestination is { shard: string; room: string } {
  return portalDestination instanceof RoomPosition;
}

const portal: StructurePortal = undefined as any;
if (isInterShardPortal(portal.destination)) {
  const { shard, room } = portal.destination;
} else {
  const destination: RoomPosition = portal.destination;
}
