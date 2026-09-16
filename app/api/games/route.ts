import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, rounds } from "@/lib/db/schema";
import { ensureIdentity } from "@/lib/session";
import { generateGameCode } from "@/lib/game-state";

const createGameSchema = z
  .object({
    hostDisplayName: z.string().trim().min(1).max(40),
    format: z.enum(["road_trip", "party"]),
    totalRounds: z.number().int().min(1).max(20).optional(),
    submissionDeadline: z.string().datetime().optional(),
  })
  .refine((data) => data.format !== "party" || data.totalRounds !== undefined, {
    message: "totalRounds is required for party games",
    path: ["totalRounds"],
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
  const { hostDisplayName, format, totalRounds, submissionDeadline } =
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
      format,
      totalRounds: format === "party" ? totalRounds : null,
      // Road Trip's only supported combination; Party doesn't use these
      // (its lifecycle is driven by `rounds` instead) but the columns are
      // NOT NULL, so both formats get the same harmless default.
      guessingMode: "all_at_once",
      revealMode: "end_of_game",
      submissionDeadline: submissionDeadline
        ? new Date(submissionDeadline)
        : null,
    })
    .returning();

  const [host] = await db
    .insert(players)
    .values({
      gameId: game.id,
      userId: identity.type === "user" ? identity.userId : null,
      guestSessionId:
        identity.type === "guest" ? identity.guestSessionId : null,
      displayName: hostDisplayName,
      isHost: true,
      joinedAtSongIndex: 0,
      joinedAtRoundIndex: 0,
    })
    .returning();

  if (format === "party") {
    await db.insert(rounds).values({
      gameId: game.id,
      roundIndex: 0,
      prompt: "",
      promptSetterPlayerId: host.id,
      status: "awaiting_prompt",
    });
  }

  return NextResponse.json({ code: game.code }, { status: 201 });
}
