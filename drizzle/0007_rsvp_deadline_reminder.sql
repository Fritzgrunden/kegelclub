ALTER TABLE "event_series" ADD COLUMN "rsvp_deadline_hours" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "rsvp_deadline_hours" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reminder_sent_at" timestamp with time zone;