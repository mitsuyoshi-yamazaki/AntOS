export const checkMemoryIntegrity = <M>(uninitializedMemory: M, initializer: (rawMemory: unknown) => M, location: string): void => {
  const uninitializedContent = JSON.stringify(uninitializedMemory)
  const actualContent = JSON.stringify(initializer({}))

  const isEqual = uninitializedContent === actualContent
  if (isEqual === true) {
    return
  }

  const errorMessage = `[${location}] 初期化前のメモリアクセスがあります\nuninitialized:\n${uninitializedContent}\nactual:\n${actualContent}`
  console.log(errorMessage)
  // throw errorMessage
}
