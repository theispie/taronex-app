ALTER TABLE "task_events" DROP CONSTRAINT "task_events_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "task_events" ALTER COLUMN "task_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;