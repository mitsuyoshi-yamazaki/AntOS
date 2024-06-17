import { ProcessTypes } from "os_v5/process/process_type_map"

/**
# SharedMemory
## 概要
- プロセスの共有メモリを管理する

## 構造
- /プロセス種別/プロセス特定子/任意の型
 */


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = new Map<ProcessTypes, Map<string, any>>()

export const SharedMemory = {
  startOfTick(): void {
    data.clear()
  },

  //
  get<T>(processType: ProcessTypes, processSpecifier: string): T | null {
    return data.get(processType)?.get(processSpecifier)
  },

  set<T>(processType: ProcessTypes, processSpecifier: string, processData: T): void {
    getProcessTypeData(processType).set(processSpecifier, processData)
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getProcessTypeData = (processType: ProcessTypes): Map<string, any> => {
  const stored = data.get(processType)
  if (stored != null) {
    return stored
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newMap = new Map<string, any>()
  data.set(processType, newMap)
  return newMap
}
