export function roomLink(roomName: string, opts?: { text?: string, color?: string }): string {
  opts = opts || {}
  const color = opts.color || "#FFFFFF"
  const text = opts.text || roomName
  return `<a href="https://screeps.com/a/#!/room/${Game.shard.name}/${roomName}", style='color:${color}'>${text}</a>`
}
