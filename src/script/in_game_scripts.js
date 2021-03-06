/* eslint-disable */

const scripts = {
  convertToV5Creeps: () => {
    Game.rooms["W52S28"].find(FIND_MY_CREEPS).forEach(creep => { creep.memory = { v: "v5", p: "W52S28", r: ["worker", "mover", "energy_store"], t: null } })
  },

  filterCreeps: () => {
    Object.keys(Game.creeps).filter(name => Game.creeps[name].room.name === "W51S29" && name.includes("SignRoomObjective")).map(name => Game.creeps[name]).forEach(creep => creep.say("Hi"))
  },

  pathFinding: () => {
    PathFinder.search(Game.spawns["Spawn2"].pos, {pos:Game.getObjectById("59f19fc582100e1594f358bd").pos, range:3}).path.forEach(pos => Game.rooms[pos.roomName].visual.text("*", pos))
  },

  removeFlags: () => {
    Game.rooms["W53S7"].find(FIND_FLAGS).forEach(flag => flag.remove())
  },
}
