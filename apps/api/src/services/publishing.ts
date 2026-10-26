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

  return publishBestEffort(deps.realtime.publisher, { workspaceId, seq }, (error) => {
    deps.telemetry.log("warn", "queue publish failed", {
      workspace_id: workspaceId,
      seq,
      error: error instanceof Error ? error.message : String(error),
    })
  })
}
