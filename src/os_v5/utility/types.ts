/// TypeScriptの初期化タイミングと実装の初期化タイミングが合わない場合に使用する
export const lazyLoad = <T>(): T => {
  throw "lazyLoad()が初期化されていません"
}
