import type { WorkspaceId } from "@workerbee/domain"

export type ChangeNotification = {
  readonly workspaceId: WorkspaceId
  readonly seq: number
}

export interface ChangePublisher {
  publish(notification: ChangeNotification): Promise<void>
}

export type HubConnection = {
  readonly workspaceId: WorkspaceId
  readonly ticket: string
  readonly since: number
  readonly request: Request
}

export interface HubRouter {
  connect(connection: HubConnection): Promise<Response> | Response
}

export async function publishBestEffort(
  publisher: ChangePublisher,
  notification: ChangeNotification,
): Promise<void> {
  try {
    await publisher.publish(notification)
  } catch {}
}
