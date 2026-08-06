import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { games, songs } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";
import { sortSongsByIndex } from "@/lib/game-state";

const advanceSchema = z.object({
  action: z.literal("next"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = advanceSchema.safeParse(body);
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
  const { db, game, me, identity } = access;

  if (!me.isHost) {
    return NextResponse.json(
      { error: "Only the host can advance the game" },
      { status: 403 },
    );
  }
  if (game.status !== "guessing") {
    return NextResponse.json(
      { error: "The game is not in the guessing phase" },
      { status: 409 },
    );
  }
  if (game.guessingMode !== "drip") {
    return NextResponse.json(
      { error: "This game doesn't use host-controlled advancing" },
      { status: 409 },
    );
  }

  const allSongs = sortSongsByIndex(
    await db.query.songs.findMany({ where: eq(songs.gameId, game.id) }),
  );
  const now = new Date();

  const currentlyOpen = allSongs.find((s) => s.unlockState === "open");
  const nextLocked = allSongs.find((s) => s.unlockState === "locked");

  if (currentlyOpen) {
    await db
      .update(songs)
      .set({ unlockState: "closed" })
      .where(eq(songs.id, currentlyOpen.id));
  }
  if (nextLocked) {
    await db
      .update(songs)
      .set({ unlockState: "open", unlockedAt: now })
      .where(eq(songs.id, nextLocked.id));
  }
  await db
    .update(games)
    .set({ currentSongPointer: game.currentSongPointer + 1 })
    .where(eq(games.id, game.id));

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
