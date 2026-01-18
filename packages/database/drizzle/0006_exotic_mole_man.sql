DROP TABLE "time_correction_request";--> statement-breakpoint
DROP TABLE "worker_location";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP CONSTRAINT "shift_assignment_adjusted_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "hourly_rate_snapshot";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "gross_pay_cents";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_in_latitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_in_longitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_in_verified";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_in_method";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_out_latitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_out_longitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_out_verified";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "clock_out_method";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "needs_review";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "review_reason";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "last_known_latitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "last_known_longitude";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "last_known_at";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "adjusted_by";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "adjusted_at";--> statement-breakpoint
ALTER TABLE "shift_assignment" DROP COLUMN IF EXISTS "adjustment_notes";