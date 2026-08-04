import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players } from "@/lib/db/schema";
import { ensureIdentity } from "@/lib/session";
import { getGameView } from "@/lib/queries/game-view";

const joinSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = getDb();
  const game = await db.query.games.findFirst({
    where: eq(games.code, code.toUpperCase()),
  });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status === "finished") {
    return NextResponse.json(
      { error: "This game has already finished" },
      { status: 409 },
    );
  }

  const identity = await ensureIdentity();

  const allPlayers = await db.query.players.findMany({
    where: eq(players.gameId, game.id),
  });
  const alreadyJoined = allPlayers.find((p) =>
    identity.type === "user"
      ? p.userId === identity.userId
      : p.guestSessionId === identity.guestSessionId,
  );

  if (!alreadyJoined) {
    await db.insert(players).values({
      gameId: game.id,
      userId: identity.type === "user" ? identity.userId : null,
      guestSessionId:
        identity.type === "guest" ? identity.guestSessionId : null,
      displayName: parsed.data.displayName,
      isHost: false,
      // Late-joiner snapshot: eligible only for songs unlocked from this point forward.
      joinedAtSongIndex: game.currentSongPointer,
    });
  }

  const view = await getGameView(code, identity);
  return NextResponse.json(view, { status: 200 });
}
