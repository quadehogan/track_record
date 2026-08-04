import { NextResponse } from "next/server";
import { searchTracks } from "@/lib/spotify";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  try {
    const results = await searchTracks(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Spotify search failed" },
      { status: 502 },
    );
  }
}
