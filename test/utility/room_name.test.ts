import { isRoomCoordinateDirection, isRoomName, RoomCoordinate, roomTypeOf } from "../../src/utility/room_name"


test("isRoomName()", () => {
  expect(isRoomName("W0N0")).toBe(true)
  expect(isRoomName("E1S1")).toBe(true)

  expect(isRoomName("")).toBe(false)

  expect(isRoomName("W0W0")).toBe(false)
  expect(isRoomName("W0E0")).toBe(false)
  expect(isRoomName("E0W0")).toBe(false)
  expect(isRoomName("E0E0")).toBe(false)
  expect(isRoomName("N0N0")).toBe(false)
  expect(isRoomName("N0S0")).toBe(false)
  expect(isRoomName("S0N0")).toBe(false)
  expect(isRoomName("S0S0")).toBe(false)

  expect(isRoomName("N0W0")).toBe(false)
  expect(isRoomName("N0E0")).toBe(false)
  expect(isRoomName("S0W0")).toBe(false)
  expect(isRoomName("S0E0")).toBe(false)
})

test("isRoomCoordinateDirection()", () => {
  expect(isRoomCoordinateDirection("NE")).toBe(true)
  expect(isRoomCoordinateDirection("NW")).toBe(true)
  expect(isRoomCoordinateDirection("SE")).toBe(true)
  expect(isRoomCoordinateDirection("SW")).toBe(true)

  expect(isRoomCoordinateDirection("EN")).toBe(false)
  expect(isRoomCoordinateDirection("WN")).toBe(false)
  expect(isRoomCoordinateDirection("ES")).toBe(false)
  expect(isRoomCoordinateDirection("WS")).toBe(false)

  expect(isRoomCoordinateDirection("")).toBe(false)
  expect(isRoomCoordinateDirection("NE ")).toBe(false)
})

test("parseRoomCoordinate()", () => {
  expect(RoomCoordinate.parse("W43S12")?.direction).toBe("SW")
  expect(RoomCoordinate.parse("W43S12")?.y).toBe(12)
  expect(RoomCoordinate.parse("W43S12")?.x).toBe(43)

  expect(RoomCoordinate.parse("E3N1")?.direction).toBe("NE")
  expect(RoomCoordinate.parse("E3N1")?.y).toBe(1)
  expect(RoomCoordinate.parse("E3N1")?.x).toBe(3)

  expect(RoomCoordinate.parse("E0S0")?.direction).toBe("SE")
  expect(RoomCoordinate.parse("E0S0")?.y).toBe(0)
  expect(RoomCoordinate.parse("E0S0")?.x).toBe(0)

  expect(RoomCoordinate.parse("")).toBeNull()
  expect(RoomCoordinate.parse("123")).toBeNull()
})

test("roomTypeOf()", () => {
  const highwayCrossing = "highway_crossing"
  const highway = "highway"
  const sectorCenter = "sector_center"
  const sourceKeeper = "source_keeper"
  const normal = "normal"

  expect(roomTypeOf("E0N0")).toBe(highwayCrossing)
  expect(roomTypeOf("W10S20")).toBe(highwayCrossing)

  expect(roomTypeOf("W24S0")).toBe(highway)
  expect(roomTypeOf("E2S20")).toBe(highway)
  expect(roomTypeOf("W30S11")).toBe(highway)

  expect(roomTypeOf("W35N25")).toBe(sectorCenter)
  expect(roomTypeOf("E5N15")).toBe(sectorCenter)

  expect(roomTypeOf("W24S5")).toBe(sourceKeeper)
  expect(roomTypeOf("E6S26")).toBe(sourceKeeper)
  expect(roomTypeOf("E14N14")).toBe(sourceKeeper)

  expect(roomTypeOf("W28S35")).toBe(normal)
  expect(roomTypeOf("E11N26")).toBe(normal)
})
