const textColors: { [index: string]: string } = {
  // Log level
  info: "white",
  warn: "#F9E79F",
  error: "#F78C6C",
  critical: "#E74C3C",

  // Capacity level
  high: "#64C3F9",    // blue
  almost: "#47CAB0",  // green
}

export type TextColor = "info" | "warn" | "error" | "critical" | "high" | "almost"
export function textColor(color: TextColor): string {
  return textColors[color]
}

export function coloredText(text: string, color: TextColor): string {
  const colorValue = textColor(color)
  return `<span style='color:${colorValue}'>${text}</span>`
}

export function roomLink(roomName: string, opts?: { text?: string, color?: string }): string {
  opts = opts || {}
  const color = opts.color || "#FFFFFF"
  const text = opts.text || roomName
  return `<a href="https://screeps.com/a/#!/room/${Game.shard.name}/${roomName}", style='color:${color}'>${text}</a>`
}
