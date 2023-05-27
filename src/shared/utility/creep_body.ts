export const CreepBody = {
  expand(shortenedDescription: [number, BodyPartConstant][]): BodyPartConstant[] {
    return shortenedDescription.flatMap(([count, body]): BodyPartConstant[] => {
      return (new Array(count)).fill(body)
    })
  },
}
