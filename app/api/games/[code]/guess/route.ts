import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { songs, guesses } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";
import { canPlayerGuessSong } from "@/lib/game-state";

const guessSchema = z.object({
  songId: z.string().uuid(),
  guessedPlayerId: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = guessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const access = await requireGameAndPlayer(code);
  if (isGameAccessError(access)) {
    return NextResponse.json(
      { error: access.error.message },
      { status: access.error.status },
    );
  }
  const { db, game, me, identity, allPlayers } = access;

  if (game.status !== "guessing") {
    return NextResponse.json(
      { error: "The game is not in the guessing phase" },
      { status: 409 },
    );
  }

  const song = await db.query.songs.findFirst({
    where: eq(songs.id, parsed.data.songId),
  });
  if (!song || song.gameId !== game.id) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }
  if (!canPlayerGuessSong(song, me.joinedAtSongIndex)) {
    return NextResponse.json(
      { error: "This song isn't open for you to guess" },
      { status: 409 },
    );
  }

  const guessedPlayer = allPlayers.find(
    (p) => p.id === parsed.data.guessedPlayerId,
  );
  if (!guessedPlayer) {
    return NextResponse.json(
      { error: "That player isn't in this game" },
      { status: 400 },
    );
  }

  const existingGuess = await db.query.guesses.findFirst({
    where: and(
      eq(guesses.songId, song.id),
      eq(guesses.guesserPlayerId, me.id),
    ),
  });
  if (existingGuess) {
    return NextResponse.json(
      { error: "You've already guessed this song" },
      { status: 409 },
    );
  }

  await db.insert(guesses).values({
    songId: song.id,
    guesserPlayerId: me.id,
    guessedPlayerId: guessedPlayer.id,
    isCorrect: guessedPlayer.id === song.submittedByPlayerId,
  });

  const view = await getGameView(code, identity);
  return NextResponse.json(view, { status: 201 });
}
