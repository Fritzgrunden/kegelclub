CREATE TABLE "dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Bisherige feste Rollen als Datensätze übernehmen (Rechte wie bisher + neue Rechte für Rollen und Beiträge).
INSERT INTO "roles" ("key", "name", "description", "permissions", "is_system", "sort_order") VALUES
	('MITGLIED', 'Mitglied', 'Basisrechte – gelten für alle.', '{profile:edit-own,members:view,events:view,events:rsvp,games:view,results:enter,stats:view,penalties:view-own,dues:view-own}', true, 0),
	('KASSENWART', 'Kassenwart', 'Strafen, Strafkatalog und Monatsbeiträge verwalten.', '{penalties:view-all,penalties:manage,penalty-catalog:manage,dues:view-all,dues:manage}', false, 1),
	('ADMIN', 'Admin', 'Mitglieder, Rollen, Termine, Spiele und Einstellungen verwalten.', '{members:manage,roles:assign,roles:manage,events:manage,games:manage,results:manage,settings:manage,penalties:view-all,dues:view-all}', true, 2);
--> statement-breakpoint
ALTER TABLE "user_roles" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "dues_cents" integer;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dues_user_month_idx" ON "dues" USING btree ("user_id","month");--> statement-breakpoint
CREATE INDEX "dues_month_idx" ON "dues" USING btree ("month");--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_roles_key_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
DROP TYPE "public"."role";