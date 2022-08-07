export type SpawnName = string

declare global {
  interface StructureSpawn {
  }
}

// サーバーリセット時のみ呼び出し
export function init(): void {
}
