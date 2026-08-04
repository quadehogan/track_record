import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { games, songs } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";
import { sortSongsByIndex } from "@/lib/game-state";

const advanceSchema = z.object({
  action: z.enum(["next", "open", "close"]),
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
  if (game.guessingMode === "all_at_once") {
    return NextResponse.json(
      { error: "This game doesn't use host-controlled advancing" },
      { status: 409 },
    );
  }

  const allSongs = sortSongsByIndex(
    await db.query.songs.findMany({ where: eq(songs.gameId, game.id) }),
  );
  const now = new Date();
  const { action } = parsed.data;

  if (game.guessingMode === "drip") {
    if (action !== "next") {
      return NextResponse.json(
        { error: "Drip mode only supports the 'next' action" },
        { status: 400 },
      );
    }
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
  } else {
    // host_paced: open/close are independent actions, so the host can pause
    // with nothing open between songs.
    if (action === "open") {
      const alreadyOpen = allSongs.some((s) => s.unlockState === "open");
      if (alreadyOpen) {
        return NextResponse.json(
          { error: "Close the current song before opening the next one" },
          { status: 409 },
        );
      }
      const nextLocked = allSongs.find((s) => s.unlockState === "locked");
      if (!nextLocked) {
        return NextResponse.json(
          { error: "No more songs to open" },
          { status: 409 },
        );
      }
      await db
        .update(songs)
        .set({ unlockState: "open", unlockedAt: now })
        .where(eq(songs.id, nextLocked.id));
      await db
        .update(games)
        .set({ currentSongPointer: game.currentSongPointer + 1 })
        .where(eq(games.id, game.id));
    } else if (action === "close") {
      const currentlyOpen = allSongs.find((s) => s.unlockState === "open");
      if (!currentlyOpen) {
        return NextResponse.json(
          { error: "No song is currently open" },
          { status: 409 },
        );
      }
      await db
        .update(songs)
        .set({ unlockState: "closed" })
        .where(eq(songs.id, currentlyOpen.id));
    } else {
      return NextResponse.json(
        { error: "host_paced mode only supports 'open' and 'close'" },
        { status: 400 },
      );
    }
  }

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
