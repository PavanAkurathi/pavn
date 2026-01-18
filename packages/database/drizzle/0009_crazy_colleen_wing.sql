CREATE INDEX IF NOT EXISTS "shift_org_status_idx" ON "shift" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_org_time_idx" ON "shift" USING btree ("organization_id","start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_status_time_idx" ON "shift" USING btree ("status","start_time") WHERE status IN ('published', 'assigned', 'in-progress');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignment_status_idx" ON "shift_assignment" USING btree ("status");