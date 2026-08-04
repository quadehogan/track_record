import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const gameStatusEnum = pgEnum("game_status", [
  "submitting",
  "guessing",
  "finished",
]);

export const guessingModeEnum = pgEnum("guessing_mode", [
  "all_at_once",
  "drip",
  "host_paced",
]);

export const revealModeEnum = pgEnum("reveal_mode", [
  "immediate",
  "end_of_song",
  "end_of_game",
]);

export const unlockStateEnum = pgEnum("unlock_state", [
  "locked",
  "open",
  "closed",
]);

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  status: gameStatusEnum("status").notNull().default("submitting"),
  guessingMode: guessingModeEnum("guessing_mode").notNull(),
  revealMode: revealModeEnum("reveal_mode").notNull(),
  submissionDeadline: timestamp("submission_deadline", { withTimezone: true }),
  currentSongPointer: integer("current_song_pointer").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    guestSessionId: text("guest_session_id"),
    displayName: text("display_name").notNull(),
    isHost: boolean("is_host").notNull().default(false),
    joinedAtSongIndex: integer("joined_at_song_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Partial unique indexes: a real account or guest session can only
    // join a given game once, but the two columns are independently nullable.
    uniqueIndex("players_game_user_unique")
      .on(table.gameId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex("players_game_guest_unique")
      .on(table.gameId, table.guestSessionId)
      .where(sql`${table.guestSessionId} IS NOT NULL`),
  ],
);

export const songs = pgTable("songs", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  submittedByPlayerId: uuid("submitted_by_player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  spotifyTrackId: text("spotify_track_id").notNull(),
  trackName: text("track_name").notNull(),
  artistName: text("artist_name").notNull(),
  albumArtUrl: text("album_art_url"),
  spotifyUrl: text("spotify_url").notNull(),
  index: integer("index"),
  unlockState: unlockStateEnum("unlock_state").notNull().default("locked"),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const guesses = pgTable(
  "guesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    guesserPlayerId: uuid("guesser_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    guessedPlayerId: uuid("guessed_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    isCorrect: boolean("is_correct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("guesses_song_guesser_unique").on(
      table.songId,
      table.guesserPlayerId,
    ),
  ],
);

export const spotifyConnections = pgTable("spotify_connections", {
  userId: text("user_id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const gamesRelations = relations(games, ({ many }) => ({
  players: many(players),
  songs: many(songs),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  game: one(games, { fields: [players.gameId], references: [games.id] }),
  submittedSongs: many(songs),
  guessesMade: many(guesses, { relationName: "guesserPlayer" }),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  game: one(games, { fields: [songs.gameId], references: [games.id] }),
  submittedBy: one(players, {
    fields: [songs.submittedByPlayerId],
    references: [players.id],
  }),
  guesses: many(guesses),
}));

export const guessesRelations = relations(guesses, ({ one }) => ({
  song: one(songs, { fields: [guesses.songId], references: [songs.id] }),
  guesser: one(players, {
    fields: [guesses.guesserPlayerId],
    references: [players.id],
    relationName: "guesserPlayer",
  }),
  guessed: one(players, {
    fields: [guesses.guessedPlayerId],
    references: [players.id],
  }),
}));

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
export type Guess = typeof guesses.$inferSelect;
export type NewGuess = typeof guesses.$inferInsert;
export type SpotifyConnection = typeof spotifyConnections.$inferSelect;
