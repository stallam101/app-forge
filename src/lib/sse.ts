import type { SSEEvent } from "@/types"

/**
 * Create a Server-Sent Events stream response.
 * Usage in API route:
 *   return createSSEResponse(async (send) => {
 *     send({ type: "log", data: { message: "hello" } })
 *   })
 */
export function createSSEResponse(
  handler: (send: (event: SSEEvent) => void, close: () => void) => Promise<void> | void
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      const close = () => {
        controller.close()
      }

      try {
        await handler(send, close)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        send({ type: "error", data: { message } })
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

/**
 * Format an SSE event string for manual streaming.
 */
export function formatSSEEvent(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
}
