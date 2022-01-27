/* eslint-disable */

const scripts = {
  convertToV5Creeps: () => {
    Game.rooms["W52S28"].find(FIND_MY_CREEPS).forEach(creep => { creep.memory = { v: "v5", p: "W52S28", r: ["worker", "mover", "energy_store"], t: null } })
  },

  filterCreeps: () => {
    Object.keys(Game.creeps).filter(name => Game.creeps[name].room.name === "W51S29" && name.includes("SignRoomObjective")).map(name => Game.creeps[name]).forEach(creep => creep.say("Hi"))
  },

  pathFinding: () => {
    PathFinder.search(Game.getObjectById("61e3d7ed8892505429ac001e").pos, { pos: Game.getObjectById("61a52e0bc661c05f84b3b43a").pos, range: 3 }).path.forEach(pos => Game.rooms[pos.roomName].visual.text("*", pos))
    (new RoomPosition(0, 16, "W18S19")).findPathTo(Game.getObjectById("61a52e0bc661c05f84b3b43a").pos, { ignoreRoads: true, swampCost: 11, plainCost: 10 }).forEach(p => Game.rooms["W18S19"].visual.text("*", p.x, p.y))
  },

  removeFlags: () => {
    Game.rooms["W53S7"].find(FIND_FLAGS).forEach(flag => flag.remove())
  },

  /**
   * - 1. distributor　processを起動
   * - 2. room_infoを削除
   */
  v5Migration: () => {
    Game.rooms.W53S5.find(FIND_MY_CREEPS).filter(c => (c.getActiveBodyparts(CARRY) > 0) && (c.memory.v == null)).forEach(c => { c.memory = { v: "v5", p: "W53S5",r: ["hauler", "mover"],t: null,i: null,}})
  }
}
