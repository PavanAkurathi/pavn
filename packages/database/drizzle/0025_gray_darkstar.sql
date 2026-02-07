CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_provider_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_org" ON "scheduled_notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shift_location_idx" ON "shift" USING btree ("location_id");