/* eslint-disable */

const scripts = {
  filterCreeps: () => {
    Object.keys(Game.creeps).filter(name => Game.creeps[name].room.name === "W51S29" && name.includes("SignRoomObjective")).map(name => Game.creeps[name]).forEach(creep => creep.say("Hi"))
  },

  pathFinding: () => {
    PathFinder.search(Game.spawns["Spawn2"].pos, {pos:Game.getObjectById("59f19fc582100e1594f358bd").pos, range:3}).path.forEach(pos => Game.rooms[pos.roomName].visual.text("*", pos))
  }
}
