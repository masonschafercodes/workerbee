ALTER TABLE "issue" DROP CONSTRAINT "issue_state_fk";--> statement-breakpoint
ALTER TABLE "workflow_state" DROP CONSTRAINT "workflow_state_workspace_id_unique";--> statement-breakpoint
ALTER TABLE "workflow_state" ADD CONSTRAINT "workflow_state_workspace_team_id_unique" UNIQUE("workspace_id","team_id","id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_state_fk" FOREIGN KEY ("workspace_id","team_id","state_id") REFERENCES "public"."workflow_state"("workspace_id","team_id","id") ON DELETE restrict ON UPDATE no action;
