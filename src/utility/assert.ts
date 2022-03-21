interface Assert {
  assert(message: string): void
  assert(condition: boolean, message: string): void
}

export const Assert: Assert = {
  assert(...args: [string] | [boolean, string]): void {
    if (typeof args[0] === "string") {
      console.assert(false, args[0])
    } else {
      const [condition, message] = args
      console.assert(condition, message)
    }
  },
}
