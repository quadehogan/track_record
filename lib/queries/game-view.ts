import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, songs, guesses, songReactions, rounds, spotifyConnections } from "@/lib/db/schema";
import type { Identity } from "@/lib/session";
import { shouldRevealSong, getEligiblePlayerIds } from "@/lib/game-state";
import { getCurrentRound } from "@/lib/queries/rounds";

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

export interface GameViewRound {
  roundIndex: number;
  totalRounds: number;
  prompt: string;
  status: "awaiting_prompt" | "submitting" | "guessing" | "revealed";
  promptSetterPlayerId: string;
  promptSetterDisplayName: string;
  isMyTurn: boolean;
}

export interface GameView {
  game: {
    code: string;
    status: "submitting" | "guessing" | "finished";
    format: "road_trip" | "party";
    guessingMode: "all_at_once" | "drip";
    revealMode: "immediate" | "end_of_song" | "end_of_game";
    submissionDeadline: string | null;
    currentSongPointer: number;
  };
  round: GameViewRound | null;
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

  const allRounds =
    game.format === "party"
      ? await db.query.rounds.findMany({ where: eq(rounds.gameId, game.id) })
      : [];
  const roundIndexById = new Map(allRounds.map((r) => [r.id, r.roundIndex]));

  /** Road Trip keys eligibility off the song's own index; Party off its round's index. */
  const eligibilityKeyFor = (song: { index: number | null; roundId: string | null }) =>
    game.format === "party"
      ? (song.roundId ? (roundIndexById.get(song.roundId) ?? null) : null)
      : song.index;

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
    const eligiblePlayerIds = getEligiblePlayerIds(
      game.format,
      eligibilityKeyFor(song),
      allPlayers,
    );
    const eligible = me ? eligiblePlayerIds.includes(me.id) : false;
    const myGuess = me
      ? (allGuesses.find(
          (g) => g.songId === song.id && g.guesserPlayerId === me.id,
        ) ?? null)
      : null;

    const guessesForSong = allGuesses.filter((g) => g.songId === song.id);
    const allEligiblePlayersGuessed =
      eligiblePlayerIds.length > 0 &&
      guessesForSong.length >= eligiblePlayerIds.length;

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

  const currentRound =
    game.format === "party" ? await getCurrentRound(db, game.id) : undefined;

  const roundView: GameView["round"] = currentRound
    ? {
        roundIndex: currentRound.roundIndex,
        totalRounds: game.totalRounds ?? 0,
        prompt: currentRound.prompt,
        status: currentRound.status,
        promptSetterPlayerId: currentRound.promptSetterPlayerId,
        promptSetterDisplayName:
          allPlayers.find((p) => p.id === currentRound.promptSetterPlayerId)
            ?.displayName ?? "",
        isMyTurn: me?.id === currentRound.promptSetterPlayerId,
      }
    : null;

  const mySubmittedSongs = me
    ? allSongs
        .filter(
          (s) =>
            s.submittedByPlayerId === me.id &&
            (game.format !== "party" || s.roundId === currentRound?.id),
        )
        .map(buildSongView)
    : [];

  // During submission, hide other players' songs entirely (anonymity + no spoilers).
  // Once guessing has started, the full list is visible — for Party, scoped to
  // the round currently being guessed; once finished, every round's songs.
  const songsForCurrentPhase =
    game.format === "party" && game.status === "guessing"
      ? allSongs.filter((s) => s.roundId === currentRound?.id)
      : allSongs;
  const visibleSongs =
    game.status === "submitting"
      ? mySubmittedSongs
      : [...songsForCurrentPhase]
          .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
          .map(buildSongView);

  const submittedCount =
    game.format === "party"
      ? allSongs.filter((s) => s.roundId === currentRound?.id).length
      : allSongs.length;

  return {
    game: {
      code: game.code,
      status: game.status,
      format: game.format,
      guessingMode: game.guessingMode,
      revealMode: game.revealMode,
      submissionDeadline: game.submissionDeadline?.toISOString() ?? null,
      currentSongPointer: game.currentSongPointer,
    },
    round: roundView,
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
          s.unlockState === "open" &&
          getEligiblePlayerIds(game.format, eligibilityKeyFor(s), allPlayers).includes(
            p.id,
          ),
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
    submittedCount,
  };
}
