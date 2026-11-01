DROP TABLE "game_results" CASCADE;--> statement-breakpoint
DROP TABLE "game_rules" CASCADE;--> statement-breakpoint
DROP TABLE "game_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "games" CASCADE;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "month_week" integer;--> statement-breakpoint
ALTER TABLE "event_series" ADD COLUMN "weekday" integer;--> statement-breakpoint
DROP TYPE "public"."game_session_status";--> statement-breakpoint
DROP TYPE "public"."scoring_mode";--> statement-breakpoint
-- Rechte der entfernten Kegelspiele aus allen Rollen streichen.
UPDATE "roles" SET "permissions" = array_remove(array_remove(array_remove(array_remove("permissions", 'games:view'), 'games:manage'), 'results:enter'), 'results:manage');
