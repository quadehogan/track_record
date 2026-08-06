ALTER TABLE "games" ALTER COLUMN "guessing_mode" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."guessing_mode";--> statement-breakpoint
CREATE TYPE "public"."guessing_mode" AS ENUM('all_at_once', 'drip');--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "guessing_mode" SET DATA TYPE "public"."guessing_mode" USING "guessing_mode"::"public"."guessing_mode";