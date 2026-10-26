import { workspaceId, type WorkspaceId } from "@workerbee/domain"
import { eq, sql } from "drizzle-orm"
import type { Database } from "./client"
import { workspace, workspaceSeq } from "./schema"

export type WorkspaceSequence = {
  readonly workspaceId: WorkspaceId
  readonly seq: number
}

/** Lists cursors for the trusted realtime sweeper, not for request handlers. */
export async function listWorkspaceSequences(db: Database): Promise<WorkspaceSequence[]> {
  const rows = await db
    .select({
      workspaceId: workspace.id,
      seq: sql<number>`coalesce(${workspaceSeq.seq}, 0)`.mapWith(Number),
    })
    .from(workspace)
    .leftJoin(workspaceSeq, eq(workspaceSeq.workspaceId, workspace.id))

  return rows.map((row) => ({ workspaceId: workspaceId(row.workspaceId), seq: row.seq }))
}
