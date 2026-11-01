CREATE TYPE "public"."cash_entry_kind" AS ENUM('EINNAHME', 'AUSGABE');--> statement-breakpoint
CREATE TABLE "cash_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "cash_entry_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"date" date NOT NULL,
	"paid_by_user_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "penalties" ADD COLUMN "credit_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_entries_date_idx" ON "cash_entries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "cash_entries_paid_by_idx" ON "cash_entries" USING btree ("paid_by_user_id");--> statement-breakpoint
-- Kassenstand sehen alle, die ihre Strafen sehen; eintragen darf, wer Strafen verwaltet.
UPDATE "roles" SET "permissions" = array_append("permissions", 'cash:view') WHERE 'penalties:view-own' = ANY("permissions") AND NOT 'cash:view' = ANY("permissions");--> statement-breakpoint
UPDATE "roles" SET "permissions" = array_append("permissions", 'cash:manage') WHERE 'penalties:manage' = ANY("permissions") AND NOT 'cash:manage' = ANY("permissions");
