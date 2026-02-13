ALTER TABLE "shift_assignment" RENAME COLUMN "estimated_cost_cents" TO "payout_amount_cents";--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "payout_amount_cents" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "shift_assignment" ALTER COLUMN "payout_amount_cents" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "shift_assignment" ADD COLUMN "total_duration_minutes" integer DEFAULT 0;