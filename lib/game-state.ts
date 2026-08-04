import type { Song } from "@/lib/db/schema";

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

export type GuessingMode = "all_at_once" | "drip" | "host_paced";
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
  // drip and host_paced both start with only the first song open;
  // the host/timer advances subsequent songs one at a time.
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
