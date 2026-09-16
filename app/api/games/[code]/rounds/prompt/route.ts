import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { rounds } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { getCurrentRound } from "@/lib/queries/rounds";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";

const promptSchema = z.object({
  prompt: z.string().trim().min(1).max(200),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = promptSchema.safeParse(body);
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

  if (game.format !== "party") {
    return NextResponse.json(
      { error: "This game doesn't use rounds" },
      { status: 409 },
    );
  }

  const round = await getCurrentRound(db, game.id);
  if (!round) {
    return NextResponse.json({ error: "No active round" }, { status: 409 });
  }
  if (round.status !== "awaiting_prompt") {
    return NextResponse.json(
      { error: "This round's prompt is already set" },
      { status: 409 },
    );
  }
  if (round.promptSetterPlayerId !== me.id) {
    return NextResponse.json(
      { error: "It's not your turn to set the prompt" },
      { status: 403 },
    );
  }

  await db
    .update(rounds)
    .set({ prompt: parsed.data.prompt, status: "submitting" })
    .where(eq(rounds.id, round.id));

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
