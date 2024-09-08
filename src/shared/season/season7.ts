const isSeason7 = Game.shard.name === "shardSeason" && typeof RESOURCE_SCORE === "string"

const season7Apis = {
  findScoreContainer(room: Room): ScoreContainer | null {
    return room.find(FIND_SCORE_CONTAINERS)[0] ?? null
  },

  findScoreCollector(room: Room): ScoreCollector | null {
    return room.find(FIND_SCORE_COLLECTORS)[0] ?? null
  },
}

export const Season7 = isSeason7 ? season7Apis : null
