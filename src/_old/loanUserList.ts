import _ from "lodash"

// League Of Automated Nations allied users list by Kamots
// Provides global.LOANlist as array of allied usernames. Array is empty if not in an alliance, but still defined.
// Updates on 2nd run and then every 1001 ticks or if the global scope gets cleared.
// Usage: After you require this file, just add this to anywhere in your main loop to run every tick: global.populateLOANlist();
// global.LOANlist will contain an array of usernames after global.populateLOANlist() runs twice in a row (two consecutive ticks).
// Memory.LOANalliance will contain the alliance short name after global.populateLOANlist() runs twice in a row (two consecutive ticks).

let lastLOANtime: number | undefined = undefined;

type LeagueOfAutomatedNations = {
  LOANlist: string[]
  napAllianceUsers: string[]

  populate(): boolean
}

export const LeagueOfAutomatedNations = {
  LOANlist: [] as string[],
  napAllianceUsers: [] as string[],

  populate(): boolean {
    const LOANuser = "LeagueOfAutomatedNations";
    const LOANsegment = 99;

    if ((typeof RawMemory.setActiveForeignSegment == "function") && !!~['shard0', 'shard1', 'shard2', 'shard3'].indexOf(Game.shard.name)) { // To skip running in sim or private servers which prevents errors
      if (typeof lastLOANtime == "undefined") {
        lastLOANtime = Game.time - 1001;
        if (typeof Memory.LOANalliance == "undefined") Memory.LOANalliance = "";
      }

      if (Game.time >= (lastLOANtime + 1000)) {
        RawMemory.setActiveForeignSegment(LOANuser, LOANsegment);
      }

      if ((Game.time >= (lastLOANtime + 1001)) && (typeof RawMemory.foreignSegment != "undefined") && (RawMemory.foreignSegment.username == LOANuser) && (RawMemory.foreignSegment.id == LOANsegment)) {
        lastLOANtime = Game.time;
        if (RawMemory.foreignSegment.data == null) {
          return false;
        } else {
          let LOANdata = JSON.parse(RawMemory.foreignSegment.data);

          if (Memory.napAlliances != null) {
            this.napAllianceUsers = Memory.napAlliances.flatMap((allianceName): string[] => {
              const usernames = LOANdata[allianceName];
              if (usernames == null) {
                return [];
              }
              return usernames;
            })
          }

          let LOANdataKeys = Object.keys(LOANdata);
          let allMyRooms = _.filter(Game.rooms, (aRoom) => (typeof aRoom.controller != "undefined") && aRoom.controller.my);
          const anyRoom = allMyRooms[0]
          if (!anyRoom || !anyRoom.controller || !anyRoom.controller.owner) {
            this.LOANlist = [];
            Memory.LOANalliance = "";
            return false;
          }
          let myUsername = anyRoom.controller.owner.username;
          for (let iL = (LOANdataKeys.length - 1); iL >= 0; iL--) {
            if (LOANdata[LOANdataKeys[iL]!].indexOf(myUsername) >= 0) {
              //console.log("Player",myUsername,"found in alliance",LOANdataKeys[iL]);
              this.LOANlist = LOANdata[LOANdataKeys[iL]!];
              Memory.LOANalliance = LOANdataKeys[iL]!.toString();
              return true;
            }
          }
          return false;
        }
      }
      return true;
    } else {
      this.LOANlist = [];
      Memory.LOANalliance = "";
      return false;
    }
  },
}
