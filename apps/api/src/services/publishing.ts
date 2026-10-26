import type { WorkspaceId } from "@workerbee/domain"
import { publishBestEffort } from "@workerbee/realtime"
import type { AppDeps } from "../deps"

export function publishCommittedChange(
  deps: AppDeps,
  workspaceId: WorkspaceId,
  seq: number | null,
): Promise<void> {
  if (seq === null) {
    return Promise.resolve()
  }

  return publishBestEffort(deps.realtime.publisher, { workspaceId, seq })
}
