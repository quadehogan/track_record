import { NextResponse } from "next/server";
import { getGameResults } from "@/lib/queries/results";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const results = await getGameResults(code);
  if (!results) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  return NextResponse.json(results);
}
