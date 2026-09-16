import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { games, rounds, songs } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { getCurrentRound } from "@/lib/queries/rounds";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";
import { getPromptSetterForRound } from "@/lib/game-state";

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
  const { db, game, me, identity, allPlayers } = access;

  if (!me.isHost) {
    return NextResponse.json(
      { error: "Only the host can end the round" },
      { status: 403 },
    );
  }
  if (game.status !== "guessing") {
    return NextResponse.json(
      { error: "The game isn't in the guessing phase" },
      { status: 409 },
    );
  }

  if (game.format === "party") {
    const round = await getCurrentRound(db, game.id);
    if (!round) {
      return NextResponse.json({ error: "No active round" }, { status: 409 });
    }

    // Closing the round reveals any songs still hidden (shouldRevealSong's
    // end_of_song rule treats "closed" the same as "everyone's guessed").
    await db
      .update(songs)
      .set({ unlockState: "closed" })
      .where(eq(songs.roundId, round.id));
    await db
      .update(rounds)
      .set({ status: "revealed" })
      .where(eq(rounds.id, round.id));

    const isLastRound = round.roundIndex + 1 >= (game.totalRounds ?? 1);
    if (isLastRound) {
      await db
        .update(games)
        .set({ status: "finished" })
        .where(eq(games.id, game.id));
    } else {
      const joinOrder = [...allPlayers].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const nextRoundIndex = round.roundIndex + 1;
      const nextPromptSetter = getPromptSetterForRound(joinOrder, nextRoundIndex);
      await db.insert(rounds).values({
        gameId: game.id,
        roundIndex: nextRoundIndex,
        prompt: "",
        promptSetterPlayerId: nextPromptSetter.id,
        status: "awaiting_prompt",
      });
      await db
        .update(games)
        .set({ status: "submitting" })
        .where(eq(games.id, game.id));
    }

    const view = await getGameView(code, identity);
    return NextResponse.json(view);
  }

  await db
    .update(games)
    .set({ status: "finished" })
    .where(eq(games.id, game.id));

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
