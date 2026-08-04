import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players } from "@/lib/db/schema";
import { ensureIdentity } from "@/lib/session";
import { generateGameCode } from "@/lib/game-state";

const createGameSchema = z.object({
  hostDisplayName: z.string().trim().min(1).max(40),
  guessingMode: z.enum(["all_at_once", "drip", "host_paced"]),
  revealMode: z.enum(["immediate", "end_of_song", "end_of_game"]),
  submissionDeadline: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { hostDisplayName, guessingMode, revealMode, submissionDeadline } =
    parsed.data;

  const identity = await ensureIdentity();
  const db = getDb();

  let code = generateGameCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.query.games.findFirst({
      where: eq(games.code, code),
    });
    if (!existing) break;
    code = generateGameCode();
  }

  const [game] = await db
    .insert(games)
    .values({
      code,
      guessingMode,
      revealMode,
      submissionDeadline: submissionDeadline
        ? new Date(submissionDeadline)
        : null,
    })
    .returning();

  await db.insert(players).values({
    gameId: game.id,
    userId: identity.type === "user" ? identity.userId : null,
    guestSessionId: identity.type === "guest" ? identity.guestSessionId : null,
    displayName: hostDisplayName,
    isHost: true,
    joinedAtSongIndex: 0,
  });

  return NextResponse.json({ code: game.code }, { status: 201 });
}
