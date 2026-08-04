import { NextResponse } from "next/server";
import { readIdentity } from "@/lib/session";
import { getGameView } from "@/lib/queries/game-view";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const identity = await readIdentity();
  const view = await getGameView(code, identity);
  if (!view) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}
