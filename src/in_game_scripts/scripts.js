/* eslint-disable */

// filter creeps
Object.keys(Game.creeps).filter(name => Game.creeps[name].room.name === "W51S29" && name.includes("creep_provider_bridging_squad")).map(name => Game.creeps[name]).forEach(creep => creep.say("Hi"))
