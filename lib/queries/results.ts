import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, songs, guesses } from "@/lib/db/schema";
import {
  countEligibleSongs,
  computePlayerScore,
  rankPlayerScores,
  isSongEligibleForPlayer,
  type PlayerScore,
} from "@/lib/scoring";

export interface PlayerScoreWithBadges extends PlayerScore {
  perfectReads: string[];
}

export async function getGameResults(code: string) {
  const db = getDb();
  const game = await db.query.games.findFirst({
    where: eq(games.code, code.toUpperCase()),
  });
  if (!game) return null;

  const allPlayers = await db.query.players.findMany({
    where: eq(players.gameId, game.id),
  });
  const allSongs = await db.query.songs.findMany({
    where: eq(songs.gameId, game.id),
  });
  const songIndices = allSongs.map((s) => s.index);
  const songIds = allSongs.map((s) => s.id);
  const allGuesses = songIds.length
    ? await db.query.guesses.findMany({
        where: inArray(guesses.songId, songIds),
      })
    : [];

  const scores: PlayerScoreWithBadges[] = allPlayers.map((player) => {
    const correctGuessCount = allGuesses.filter(
      (g) => g.guesserPlayerId === player.id && g.isCorrect,
    ).length;
    const eligibleSongs = countEligibleSongs(
      songIndices,
      player.joinedAtSongIndex,
    );
    const score = computePlayerScore(
      {
        playerId: player.id,
        displayName: player.displayName,
        joinedAtSongIndex: player.joinedAtSongIndex,
        correctGuessCount,
      },
      eligibleSongs,
    );

    // "Perfect read": every eligible song from a given submitter, guessed correctly.
    const perfectReads = allPlayers
      .filter((submitter) => submitter.id !== player.id)
      .filter((submitter) => {
        const submitterSongs = allSongs.filter(
          (s) =>
            s.submittedByPlayerId === submitter.id &&
            isSongEligibleForPlayer(s.index, player.joinedAtSongIndex),
        );
        if (submitterSongs.length === 0) return false;
        return submitterSongs.every((s) =>
          allGuesses.some(
            (g) =>
              g.songId === s.id &&
              g.guesserPlayerId === player.id &&
              g.isCorrect,
          ),
        );
      })
      .map((submitter) => submitter.displayName);

    return { ...score, perfectReads };
  });

  return {
    gameStatus: game.status,
    scores: rankPlayerScores(scores),
  };
}
