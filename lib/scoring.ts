export interface PlayerScoreInput {
  playerId: string;
  displayName: string;
  joinedAtSongIndex: number;
  correctGuessCount: number;
}

export interface PlayerScore {
  playerId: string;
  displayName: string;
  rawScore: number;
  eligibleSongs: number;
  accuracy: number;
}

/** A song is eligible for a player only if it unlocked at/after they joined. */
export function isSongEligibleForPlayer(
  songIndex: number | null,
  joinedAtSongIndex: number,
): boolean {
  return songIndex !== null && songIndex >= joinedAtSongIndex;
}

export function countEligibleSongs(
  songIndices: Array<number | null>,
  joinedAtSongIndex: number,
): number {
  return songIndices.filter((index) =>
    isSongEligibleForPlayer(index, joinedAtSongIndex),
  ).length;
}

export function computePlayerScore(
  input: PlayerScoreInput,
  eligibleSongs: number,
): PlayerScore {
  return {
    playerId: input.playerId,
    displayName: input.displayName,
    rawScore: input.correctGuessCount,
    eligibleSongs,
    accuracy: eligibleSongs === 0 ? 0 : input.correctGuessCount / eligibleSongs,
  };
}

/** Ranks by accuracy first (per spec: don't just rank by raw score), raw score as tiebreaker. */
export function rankPlayerScores<T extends PlayerScore>(scores: T[]): T[] {
  return [...scores].sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return b.rawScore - a.rawScore;
  });
}
