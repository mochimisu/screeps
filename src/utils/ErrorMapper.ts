import { SourceMapConsumer } from "source-map";

export class ErrorMapper {
  // Cache the consumer (only one per process)
  private static _consumer?: SourceMapConsumer;

  /**
   * Asynchronously returns the cached SourceMapConsumer, creating it if needed.
   */
  private static async getConsumer(): Promise<SourceMapConsumer> {
    if (!this._consumer) {
      // Load the raw source map data from file.
      const rawSourceMap = require("main.js.map");
      // Await the asynchronous creation of the consumer.
      this._consumer = await new SourceMapConsumer(rawSourceMap);
    }
    return this._consumer;
  }

  // Cache previously mapped traces to improve performance.
  public static cache: { [key: string]: string } = {};

  /**
   * Generates a source-mapped stack trace from the given error or error string.
   *
   * WARNING - EXTREMELY high CPU cost for first call after reset - >30 CPU! Use sparingly!
   * (Consecutive calls after a reset are more reasonable, ~0.1 CPU/ea)
   *
   * @param {Error | string} error The error or original stack trace.
   * @returns {Promise<string>} A promise for the source-mapped stack trace.
   */
  public static async sourceMappedStackTrace(error: Error | string): Promise<string> {
    const stack: string = error instanceof Error ? (error.stack as string) : error;
    if (Object.prototype.hasOwnProperty.call(this.cache, stack)) {
      return this.cache[stack];
    }

    // Regular expression to parse stack trace lines.
    const re = /^\s+at\s+(.+?\s+)?\(?([0-z._\-\\\/]+):(\d+):(\d+)\)?$/gm;
    let match: RegExpExecArray | null;
    let outStack = error.toString();

    // Await the consumer (which will be created if not already cached).
    const consumer = await this.getConsumer();

    while ((match = re.exec(stack))) {
      // If the file name is "main", we try to retrieve its original position.
      if (match[2] === "main") {
        const pos = consumer.originalPositionFor({
          column: parseInt(match[4], 10),
          line: parseInt(match[3], 10)
        });

        if (pos.line != null) {
          if (pos.name) {
            outStack += `\n    at ${pos.name} (${pos.source}:${pos.line}:${pos.column})`;
          } else if (match[1]) {
            // No original symbol name; use the name from the trace.
            outStack += `\n    at ${match[1]} (${pos.source}:${pos.line}:${pos.column})`;
          } else {
            // No name information available.
            outStack += `\n    at ${pos.source}:${pos.line}:${pos.column}`;
          }
        } else {
          // No known mapping for this line.
          break;
        }
      } else {
        // If the line does not match the expected file name, stop parsing.
        break;
      }
    }

    this.cache[stack] = outStack;
    return outStack;
  }

  /**
   * Wraps a loop function with error handling that prints a source-mapped stack trace.
   *
   * @param {() => void} loop The loop function to wrap.
   * @returns {() => Promise<void>} A new async function that wraps the loop.
   */
  public static wrapLoop(loop: () => void): () => Promise<void> {
    return async () => {
      try {
        loop();
      } catch (e) {
        if (e instanceof Error) {
          // In the simulator, source maps may not work so we log the original error.
          if ("sim" in Game.rooms) {
            const message = `Source maps don't work in the simulator - displaying original error`;
            console.log(`<span style='color:red'>${message}<br>${_.escape(e.stack)}</span>`);
          } else {
            // Await the asynchronous source mapping of the error.
            const mappedStack = await this.sourceMappedStackTrace(e);
            console.log(`<span style='color:red'>${_.escape(mappedStack)}</span>`);
          }
        } else {
          // If it's not an Error, rethrow.
          throw e;
        }
      }
    };
  }
}
