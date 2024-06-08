/**
# SharedMemory
## 概要
- プロセスの共有メモリを管理する

## 構造
- /プロセス種別/プロセス特定子/任意の型
 */

const data = new Map<string, Map<string, any>>()

export const SharedMemory = {
  startOfTick(): void {
    data.clear()
  },

  //
  get<T>(processType: string, processSpecifier: string): T | null {
    return data.get(processType)?.get(processSpecifier)
  },

  set<T>(processType: string, processSpecifier: string, processData: T): void {
    getProcessTypeData(processType).set(processSpecifier, processData)
  },
}

const getProcessTypeData = (processType: string): Map<string, any> => {
  const stored = data.get(processType)
  if (stored != null) {
    return stored
  }

  const newMap = new Map<string, any>()
  data.set(processType, newMap)
  return newMap
}
