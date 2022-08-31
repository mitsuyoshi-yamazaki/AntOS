declare global {
  interface Game {
    io: (message: string) => string
  }
}

// declare globalを他ファイルからimportするためのダミー値
// .d.tsからは（少なくともエディタ上は）読み込まれないため
export const GlobalGame = "GlobalGame"
