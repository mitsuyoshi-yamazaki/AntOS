export function calculateTowerDamage(range: number): number {
  if (range >= 20) {
    return 150
  }
  if (range <= 5) {
    return 600
  }
  return 600 - ((range - 5) * 30)
}
