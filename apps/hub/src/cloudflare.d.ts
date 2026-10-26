interface ResponseInit {
  webSocket?: WebSocket
}

interface WebSocket {
  serializeAttachment(value: unknown): void
  deserializeAttachment(): unknown
}

declare class WebSocketPair {
  readonly 0: WebSocket
  readonly 1: WebSocket
}
