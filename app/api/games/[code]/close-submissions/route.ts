import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { songs, rounds } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { getCurrentRound } from "@/lib/queries/rounds";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";
import { shuffle, initialUnlockStates } from "@/lib/game-state";
import { games as gamesTable } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const access = await requireGameAndPlayer(code);
  if (isGameAccessError(access)) {
    return NextResponse.json(
      { error: access.error.message },
      { status: access.error.status },
    );
  }
  const { db, game, me, identity } = access;

  if (!me.isHost) {
    return NextResponse.json(
      { error: "Only the host can close submissions" },
      { status: 403 },
    );
  }
  if (game.status !== "submitting") {
    return NextResponse.json(
      { error: "Submissions are already closed" },
      { status: 409 },
    );
  }

  let round;
  if (game.format === "party") {
    round = await getCurrentRound(db, game.id);
    if (!round || round.status !== "submitting") {
      return NextResponse.json(
        { error: "This round isn't ready to close" },
        { status: 409 },
      );
    }
  }

  const allSongs = round
    ? await db.query.songs.findMany({ where: eq(songs.roundId, round.id) })
    : await db.query.songs.findMany({ where: eq(songs.gameId, game.id) });
  if (allSongs.length === 0) {
    return NextResponse.json(
      { error: "At least one song must be submitted first" },
      { status: 400 },
    );
  }

  const order = shuffle(allSongs);
  const unlockStates = initialUnlockStates(game.guessingMode, order.length);
  const now = new Date();

  await Promise.all(
    order.map((song, index) =>
      db
        .update(songs)
        .set({
          index,
          unlockState: unlockStates[index],
          unlockedAt: unlockStates[index] === "open" ? now : null,
        })
        .where(eq(songs.id, song.id)),
    ),
  );

  if (round) {
    await db
      .update(rounds)
      .set({ status: "guessing" })
      .where(eq(rounds.id, round.id));
  }

  await db
    .update(gamesTable)
    .set({ status: "guessing", currentSongPointer: 0 })
    .where(eq(gamesTable.id, game.id));

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
