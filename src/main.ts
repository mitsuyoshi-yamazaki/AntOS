import { ErrorMapper } from "ErrorMapper"
import { hoge } from "test"
import Tasks from 'creep-tasks'

export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Hello, World`)
  hoge()
})
