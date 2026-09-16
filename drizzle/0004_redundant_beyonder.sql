CREATE TYPE "public"."game_format" AS ENUM('road_trip', 'party');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('awaiting_prompt', 'submitting', 'guessing', 'revealed');--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_index" integer NOT NULL,
	"prompt" text NOT NULL,
	"prompt_setter_player_id" uuid NOT NULL,
	"status" "round_status" DEFAULT 'awaiting_prompt' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "format" "game_format" DEFAULT 'road_trip' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "total_rounds" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "joined_at_round_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_prompt_setter_player_id_players_id_fk" FOREIGN KEY ("prompt_setter_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_game_index_unique" ON "rounds" USING btree ("game_id","round_index");--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;