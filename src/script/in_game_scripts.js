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
  },

  destroyStructures: () => {
    Game.rooms.E35N53.find(FIND_STRUCTURES).filter(s => [STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_NUKER].includes(s.structureType) !== true).forEach(s => s.destroy())
  },

  nukerStatus: () => {
    Array.from(Object.values(Game.rooms)).map(r => r.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]).filter(n => n != null && n.isActive() && (n.store.getFreeCapacity("G") > 0 || n.store.getFreeCapacity("energy") > 0)).forEach(n => console.log(n.room.name + " G: " + n.store.getUsedCapacity("G") + "/5000, energy: " + Math.floor(n.store.getUsedCapacity("energy") / 1000) + "k/300k"))
  },

  noNukerRooms: () => {
    Array.from(Object.values(Game.rooms)).filter(r => r.controller && r.controller.my && r.controller.level >= 8 && r.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } }).length <= 0).forEach(r => console.log(r.name))
  },

  nukerReady: () => {
    Array.from(Object.values(Game.rooms)).map(r => r.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]).filter(n => n != null && Game.map.getRoomLinearDistance("E50N50", n.room.name) <= 30 && n.store.getFreeCapacity("G") <= 0 && n.store.getFreeCapacity("energy") <= 0).forEach(n => console.log(n.room.name + (n.cooldown <= 0 ? "" : "(" + n.cooldown + ")")))
  },

  findNukes: () => {
    Array.from(Object.values(Game.rooms)).filter(r => r.controller && r.controller.my && r.find(FIND_NUKES).length > 0).forEach(r => console.log(r.name))
  },

  roomWithNoCoreLink: () => {
    Array.from(Object.entries(Memory.v6RoomInfo)).filter(([, i]) => i.links != null && i.links.coreLinkId == null).forEach(([r,]) => console.log(r))
  },

  droppedResourceAmount: () => {
    Array.from(Object.values(Game.rooms)).filter(r => r.controller && r.controller.my).map(r => ([r, r.find(FIND_DROPPED_RESOURCES).reduce((result, resource) => result + resource.amount, 0)])).filter(([r, a]) => a > 1000).forEach(([r, a]) => console.log(r + ": " + a))
  },

  unnecessaryFlags: () => {
    Array.from(new Set(Array.from(Object.values(Game.flags)).filter(f => f.pos.x !== 0 && f.pos.x !== 49 && f.pos.y !== 0 && f.pos.y !== 49).filter(f => f.room == null || f.room.controller == null || f.room.controller.my !== true).map(f => f.pos.roomName))).forEach(x => console.log(x))
  },

  removeFlagsInInvisibleRoom: () => {
    Array.from(Object.values(Game.flags)).filter(f => f.room == null && f.pos.roomName === "E33N56").forEach(f => f.remove())
  },
}
