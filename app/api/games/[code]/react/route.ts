import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { songs, songReactions } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";

const REACTION_EMOJIS = ["🔥", "😂", "❤️", "😮", "🎯", "👎"] as const;

const reactSchema = z.object({
  songId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS).nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = reactSchema.safeParse(body);
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

  if (game.status === "submitting") {
    return NextResponse.json(
      { error: "Reactions open once guessing starts" },
      { status: 409 },
    );
  }

  const song = await db.query.songs.findFirst({
    where: eq(songs.id, parsed.data.songId),
  });
  if (!song || song.gameId !== game.id) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }

  if (parsed.data.emoji === null) {
    await db
      .delete(songReactions)
      .where(
        and(
          eq(songReactions.songId, song.id),
          eq(songReactions.playerId, me.id),
        ),
      );
  } else {
    await db
      .insert(songReactions)
      .values({ songId: song.id, playerId: me.id, emoji: parsed.data.emoji })
      .onConflictDoUpdate({
        target: [songReactions.songId, songReactions.playerId],
        set: { emoji: parsed.data.emoji },
      });
  }

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
