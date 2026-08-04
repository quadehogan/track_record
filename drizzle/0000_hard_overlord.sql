CREATE TYPE "public"."game_status" AS ENUM('submitting', 'guessing', 'finished');--> statement-breakpoint
CREATE TYPE "public"."guessing_mode" AS ENUM('all_at_once', 'drip', 'host_paced');--> statement-breakpoint
CREATE TYPE "public"."reveal_mode" AS ENUM('immediate', 'end_of_song', 'end_of_game');--> statement-breakpoint
CREATE TYPE "public"."unlock_state" AS ENUM('locked', 'open', 'closed');--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_user_id" text NOT NULL,
	"status" "game_status" DEFAULT 'submitting' NOT NULL,
	"guessing_mode" "guessing_mode" NOT NULL,
	"reveal_mode" "reveal_mode" NOT NULL,
	"submission_deadline" timestamp with time zone,
	"current_song_pointer" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "guesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"guesser_player_id" uuid NOT NULL,
	"guessed_player_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" text,
	"guest_session_id" text,
	"display_name" text NOT NULL,
	"is_host" boolean DEFAULT false NOT NULL,
	"joined_at_song_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"submitted_by_player_id" uuid NOT NULL,
	"spotify_track_id" text NOT NULL,
	"track_name" text NOT NULL,
	"artist_name" text NOT NULL,
	"album_art_url" text,
	"spotify_url" text NOT NULL,
	"index" integer,
	"unlock_state" "unlock_state" DEFAULT 'locked' NOT NULL,
	"unlocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_guesser_player_id_players_id_fk" FOREIGN KEY ("guesser_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_guessed_player_id_players_id_fk" FOREIGN KEY ("guessed_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_submitted_by_player_id_players_id_fk" FOREIGN KEY ("submitted_by_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guesses_song_guesser_unique" ON "guesses" USING btree ("song_id","guesser_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_game_user_unique" ON "players" USING btree ("game_id","user_id") WHERE "players"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "players_game_guest_unique" ON "players" USING btree ("game_id","guest_session_id") WHERE "players"."guest_session_id" IS NOT NULL;