import type {
  ChangeNotification,
  ChangePublisher,
  HubConnection,
  HubRouter,
} from "@workerbee/realtime"

export type QueueBinding = {
  send(message: ChangeNotification): Promise<unknown>
}

export type HubNamespace = {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(request: Request): Promise<Response> }
}

export class QueueChangePublisher implements ChangePublisher {
  constructor(private readonly queue: QueueBinding) {}

  async publish(notification: ChangeNotification): Promise<void> {
    await this.queue.send(notification)
  }
}

export class DurableObjectHubRouter implements HubRouter {
  constructor(private readonly namespace: HubNamespace) {}

  connect(connection: HubConnection): Promise<Response> {
    const id = this.namespace.idFromName(connection.workspaceId)
    const stub = this.namespace.get(id)

    return stub.fetch(connection.request)
  }
}
