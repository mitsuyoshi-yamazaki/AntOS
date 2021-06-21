import { isProcedural, isStatefulProcess, Procedural, StatefulProcess } from "../../src/process/process"

class SomeObject { }

test("isStatefulProcess()", () => {
  class SomeStatefulProcess implements StatefulProcess {
    public readonly launchTime = 0
    public readonly shouldStore = true
    public readonly processId = 0

    public encode(): unknown {
      return null
    }
  }

  expect(isStatefulProcess(new SomeStatefulProcess())).toBe(true)
  expect(isStatefulProcess(new SomeObject())).toBe(false)
})

test("isProcedural()", () => {
  class SomeProceduralObject implements Procedural {
    public runOnTick(): void { }
  }

  expect(isProcedural(new SomeProceduralObject())).toBe(true)
  expect(isProcedural(new SomeObject())).toBe(false)
})
