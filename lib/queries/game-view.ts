import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, songs, guesses, songReactions, spotifyConnections } from "@/lib/db/schema";
import type { Identity } from "@/lib/session";
import { isSongEligibleForPlayer } from "@/lib/scoring";
import { shouldRevealSong } from "@/lib/game-state";

export interface GameViewSong {
  id: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  spotifyUrl: string;
  index: number | null;
  unlockState: "locked" | "open" | "closed";
  eligible: boolean;
  myGuessedPlayerId: string | null;
  revealedSubmitter: { playerId: string; displayName: string } | null;
  reactions: Array<{ emoji: string; count: number }>;
  myReaction: string | null;
}

export interface GameView {
  game: {
    code: string;
    status: "submitting" | "guessing" | "finished";
    guessingMode: "all_at_once" | "drip";
    revealMode: "immediate" | "end_of_song" | "end_of_game";
    submissionDeadline: string | null;
    currentSongPointer: number;
  };
  me: {
    id: string;
    displayName: string;
    isHost: boolean;
    isGuest: boolean;
    joinedAtSongIndex: number;
    spotifyConnected: boolean;
  } | null;
  players: Array<{
    id: string;
    displayName: string;
    isHost: boolean;
    guessProgress: { done: number; total: number };
  }>;
  songs: GameViewSong[];
  mySubmittedSongs: GameViewSong[];
  submittedCount: number;
}

export async function getGameView(
  code: string,
  identity: Identity | null,
): Promise<GameView | null> {
  const db = getDb();
  const game = await db.query.games.findFirst({
    where: eq(games.code, code.toUpperCase()),
  });
  if (!game) return null;

  const allPlayers = await db.query.players.findMany({
    where: eq(players.gameId, game.id),
  });

  const me = identity
    ? (allPlayers.find((p) =>
        identity.type === "user"
          ? p.userId === identity.userId
          : p.guestSessionId === identity.guestSessionId,
      ) ?? null)
    : null;

  const allSongs = await db.query.songs.findMany({
    where: eq(songs.gameId, game.id),
  });

  const songIds = allSongs.map((s) => s.id);
  const allGuesses = songIds.length
    ? await db.query.guesses.findMany({
        where: inArray(guesses.songId, songIds),
      })
    : [];
  const allReactions = songIds.length
    ? await db.query.songReactions.findMany({
        where: inArray(songReactions.songId, songIds),
      })
    : [];

  const buildSongView = (song: (typeof allSongs)[number]): GameViewSong => {
    const eligible = me
      ? isSongEligibleForPlayer(song.index, me.joinedAtSongIndex)
      : false;
    const myGuess = me
      ? (allGuesses.find(
          (g) => g.songId === song.id && g.guesserPlayerId === me.id,
        ) ?? null)
      : null;

    const guessesForSong = allGuesses.filter((g) => g.songId === song.id);
    const eligiblePlayerCount = allPlayers.filter((p) =>
      isSongEligibleForPlayer(song.index, p.joinedAtSongIndex),
    ).length;
    const allEligiblePlayersGuessed =
      eligiblePlayerCount > 0 && guessesForSong.length >= eligiblePlayerCount;

    const revealed =
      game.status === "finished" ||
      (myGuess !== null &&
        shouldRevealSong(
          game.revealMode,
          game.status,
          song,
          allEligiblePlayersGuessed,
        ));

    let revealedSubmitter: GameViewSong["revealedSubmitter"] = null;
    if (revealed) {
      const submitter = allPlayers.find(
        (p) => p.id === song.submittedByPlayerId,
      );
      if (submitter) {
        revealedSubmitter = {
          playerId: submitter.id,
          displayName: submitter.displayName,
        };
      }
    }

    let reactions: GameViewSong["reactions"] = [];
    let myReaction: string | null = null;
    if (revealed) {
      const reactionsForSong = allReactions.filter(
        (r) => r.songId === song.id,
      );
      const counts = new Map<string, number>();
      for (const r of reactionsForSong) {
        counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
      }
      reactions = [...counts.entries()].map(([emoji, count]) => ({
        emoji,
        count,
      }));
      myReaction = me
        ? (reactionsForSong.find((r) => r.playerId === me.id)?.emoji ?? null)
        : null;
    }

    return {
      id: song.id,
      trackName: song.trackName,
      artistName: song.artistName,
      albumArtUrl: song.albumArtUrl,
      spotifyUrl: song.spotifyUrl,
      index: song.index,
      unlockState: song.unlockState,
      eligible,
      myGuessedPlayerId: myGuess?.guessedPlayerId ?? null,
      revealedSubmitter,
      reactions,
      myReaction,
    };
  };

  const spotifyConnection =
    me?.isHost && identity?.type === "user"
      ? await db.query.spotifyConnections.findFirst({
          where: eq(spotifyConnections.userId, identity.userId),
        })
      : undefined;

  const mySubmittedSongs = me
    ? allSongs
        .filter((s) => s.submittedByPlayerId === me.id)
        .map(buildSongView)
    : [];

  // During submission, hide other players' songs entirely (anonymity + no spoilers).
  // Once guessing has started the full, index-ordered list is visible to everyone.
  const visibleSongs =
    game.status === "submitting"
      ? mySubmittedSongs
      : [...allSongs]
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map(buildSongView);

  return {
    game: {
      code: game.code,
      status: game.status,
      guessingMode: game.guessingMode,
      revealMode: game.revealMode,
      submissionDeadline: game.submissionDeadline?.toISOString() ?? null,
      currentSongPointer: game.currentSongPointer,
    },
    me: me
      ? {
          id: me.id,
          displayName: me.displayName,
          isHost: me.isHost,
          isGuest: identity?.type !== "user",
          joinedAtSongIndex: me.joinedAtSongIndex,
          spotifyConnected: Boolean(spotifyConnection),
        }
      : null,
    players: allPlayers.map((p) => {
      const eligibleOpenSongs = allSongs.filter(
        (s) =>
          isSongEligibleForPlayer(s.index, p.joinedAtSongIndex) &&
          s.unlockState === "open",
      );
      const done = eligibleOpenSongs.filter((s) =>
        allGuesses.some(
          (g) => g.songId === s.id && g.guesserPlayerId === p.id,
        ),
      ).length;
      return {
        id: p.id,
        displayName: p.displayName,
        isHost: p.isHost,
        guessProgress: { done, total: eligibleOpenSongs.length },
      };
    }),
    songs: visibleSongs,
    mySubmittedSongs,
    submittedCount: allSongs.length,
  };
}
