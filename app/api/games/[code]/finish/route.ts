import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { games } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";

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
      { error: "Only the host can end the game" },
      { status: 403 },
    );
  }
  if (game.status !== "guessing") {
    return NextResponse.json(
      { error: "The game isn't in the guessing phase" },
      { status: 409 },
    );
  }

  await db
    .update(games)
    .set({ status: "finished" })
    .where(eq(games.id, game.id));

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
