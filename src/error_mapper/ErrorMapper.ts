/* eslint-disable */
// It's from https://github.com/screepers/screeps-typescript-starter
// https://github.com/screepers/screeps-typescript-starter/blob/master/LICENSE

// tslint:disable:no-conditional-assignment
import { SourceMapConsumer } from "source-map"

import _ from "lodash"

export class ErrorMapper {
  // Cache consumer
  private static _consumer?: SourceMapConsumer

  public static get consumer(): SourceMapConsumer {
    if (this._consumer == null) {
      this._consumer = new SourceMapConsumer(require("main.js.map"))
    }

    return this._consumer
  }

  // Cache previously mapped traces to improve performance
  public static cache: { [key: string]: string } = {}

  /**
   * Generates a stack trace using a source map generate original symbol names.
   *
   * WARNING - EXTREMELY high CPU cost for first call after reset - >30 CPU! Use sparingly!
   * (Consecutive calls after a reset are more reasonable, ~0.1 CPU/ea)
   *
   * @param {Error | string} error The error or original stack trace
   * @returns {string} The source-mapped stack trace
   */
  public static sourceMappedStackTrace(error: Error | string): string | undefined {
    const stack: string = error instanceof Error ? error.stack as string : error
    if (this.cache.hasOwnProperty(stack)) {
      return this.cache[stack]
    }

    const re = /^\s+at\s+(.+?\s+)?\(?([0-z._\-\\\/]+):(\d+):(\d+)\)?$/gm
    let match: RegExpExecArray | null
    let outStack = error.toString()
    const parseInteger = (rawValue: string | undefined): number => {
      if (rawValue == null) {
        return NaN
      }
      return parseInt(rawValue, 10)
    }

    while (match = re.exec(stack)) {
      if (match[2] === "main") {
        const pos = this.consumer.originalPositionFor({
          column: parseInteger(match[4]),
          line: parseInteger(match[3])
        })

        if (pos.line != null) {
          if (pos.name) {
            outStack += `\n    at ${pos.name} (${pos.source}:${pos.line}:${pos.column})`
          } else {
            if (match[1]) {
              // no original source file name known - use file name from given trace
              outStack += `\n    at ${match[1]} (${pos.source}:${pos.line}:${pos.column})`
            } else {
              // no original source file name known or in given trace - omit name
              outStack += `\n    at ${pos.source}:${pos.line}:${pos.column}`
            }
          }
        } else {
          // no known position
          break
        }
      } else {
        // no more parseable lines
        break
      }
    }

    this.cache[stack] = outStack
    return outStack
  }

  public static wrapLoop<T>(loop: () => T, label?: string): () => T | null {
    return (): T | null => {
      try {
        return loop()
      } catch (e) {
        if (e instanceof Error) {
          let full_message = ""
          if ("sim" in Game.rooms) {
            const message = `Source maps don't work in the simulator - displaying original error`
            full_message = `<span style='color:red'>${message}<br>${_.escape(e.stack)}</span>`
          } else {
            full_message = `<span style='color:red'>${_.escape(this.sourceMappedStackTrace(e))}</span>`
          }
          console.log(full_message)
          Game.notify(full_message)

        } else {
          // can't handle it
          throw e
        }
      }
      return null
    }
  }
}
