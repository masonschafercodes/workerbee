CREATE TABLE "workspace_seq" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_seq" ADD CONSTRAINT "workspace_seq_workspace_id_organization_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;