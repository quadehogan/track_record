import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, songs, guesses } from "@/lib/db/schema";
import { countEligibleSongs, computePlayerScore, rankPlayerScores } from "@/lib/scoring";

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

  const scores = allPlayers.map((player) => {
    const correctGuessCount = allGuesses.filter(
      (g) => g.guesserPlayerId === player.id && g.isCorrect,
    ).length;
    const eligibleSongs = countEligibleSongs(
      songIndices,
      player.joinedAtSongIndex,
    );
    return computePlayerScore(
      {
        playerId: player.id,
        displayName: player.displayName,
        joinedAtSongIndex: player.joinedAtSongIndex,
        correctGuessCount,
      },
      eligibleSongs,
    );
  });

  return {
    gameStatus: game.status,
    scores: rankPlayerScores(scores),
  };
}
