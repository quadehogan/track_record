import type { Song } from "@/lib/db/schema";
import { isSongEligibleForPlayer } from "@/lib/scoring";

/** Short, easy-to-read shareable code (excludes ambiguous chars like 0/O, 1/I). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGameCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Fisher-Yates shuffle, returns a new array — used to assign random song order on close. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export type GuessingMode = "all_at_once" | "drip";
export type RevealMode = "immediate" | "end_of_song" | "end_of_game";
export type UnlockState = "locked" | "open" | "closed";

/** What unlock_state each song (in shuffled index order) should start at when submissions close. */
export function initialUnlockStates(
  guessingMode: GuessingMode,
  songCount: number,
): UnlockState[] {
  if (songCount === 0) return [];
  if (guessingMode === "all_at_once") {
    return Array(songCount).fill("open");
  }
  // drip starts with only the first song open; the host advances the rest
  // one at a time.
  return ["open", ...Array(songCount - 1).fill("locked")];
}

export function canPlayerGuessSong(
  song: { index: number | null; unlockState: UnlockState },
  joinedAtSongIndex: number,
): boolean {
  return (
    song.index !== null &&
    song.index >= joinedAtSongIndex &&
    song.unlockState === "open"
  );
}

/**
 * Whether the identity of the submitter should be revealed to the client now.
 * `immediate` reveals right after a guess is made; `end_of_song` waits for every
 * eligible player to have guessed (or the host to advance past it); `end_of_game`
 * withholds until the game is finished.
 */
export function shouldRevealSong(
  revealMode: RevealMode,
  gameStatus: "submitting" | "guessing" | "finished",
  song: { unlockState: UnlockState },
  allEligiblePlayersGuessed: boolean,
): boolean {
  if (gameStatus === "finished") return true;
  if (revealMode === "immediate") return true;
  if (revealMode === "end_of_song") {
    return song.unlockState === "closed" || allEligiblePlayersGuessed;
  }
  return false; // end_of_game, game still in progress
}

export function sortSongsByIndex(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export type GameFormat = "road_trip" | "party";
export type RoundStatus = "awaiting_prompt" | "submitting" | "guessing" | "revealed";

/**
 * Party mode's prompt-setter rotates through players in join order, one per
 * round, wrapping around once everyone's had a turn. `players` must already
 * be sorted by join order (oldest first).
 */
export function getPromptSetterForRound<T>(players: T[], roundIndex: number): T {
  return players[roundIndex % players.length];
}

/** Party's parallel to `canPlayerGuessSong`/eligibility, but keyed on round instead of song index. */
export function isRoundEligibleForPlayer(
  roundIndex: number,
  joinedAtRoundIndex: number,
): boolean {
  return roundIndex >= joinedAtRoundIndex;
}

/**
 * Which players are eligible to guess a given song: Road Trip keys eligibility
 * off the song's own index, Party off the round it belongs to (every song in a
 * round shares the same eligibility set). `eligibilityKey` is `song.index` for
 * Road Trip or the song's round's `roundIndex` for Party — pass `null` if the
 * key can't be resolved (e.g. an orphaned song), which yields no eligible players.
 */
export function getEligiblePlayerIds(
  format: GameFormat,
  eligibilityKey: number | null,
  allPlayers: Array<{ id: string; joinedAtSongIndex: number; joinedAtRoundIndex: number }>,
): string[] {
  if (eligibilityKey === null) return [];
  return allPlayers
    .filter((p) =>
      format === "party"
        ? isRoundEligibleForPlayer(eligibilityKey, p.joinedAtRoundIndex)
        : isSongEligibleForPlayer(eligibilityKey, p.joinedAtSongIndex),
    )
    .map((p) => p.id);
}
