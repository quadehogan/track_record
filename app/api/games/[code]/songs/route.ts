import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { songs } from "@/lib/db/schema";
import { getGameView } from "@/lib/queries/game-view";
import { getCurrentRound } from "@/lib/queries/rounds";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";

const submitSongSchema = z.object({
  spotifyTrackId: z.string().min(1),
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  albumArtUrl: z.string().url().nullable(),
  spotifyUrl: z.string().url(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json();
  const parsed = submitSongSchema.safeParse(body);
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

  if (game.status !== "submitting") {
    return NextResponse.json(
      { error: "Submissions are closed for this game" },
      { status: 409 },
    );
  }

  let roundId: string | null = null;
  if (game.format === "party") {
    const round = await getCurrentRound(db, game.id);
    if (!round || round.status !== "submitting") {
      return NextResponse.json(
        { error: "Waiting for this round's prompt to be set" },
        { status: 409 },
      );
    }
    const existing = await db.query.songs.findFirst({
      where: and(
        eq(songs.roundId, round.id),
        eq(songs.submittedByPlayerId, me.id),
      ),
    });
    if (existing) {
      return NextResponse.json(
        { error: "You've already submitted a song for this round" },
        { status: 409 },
      );
    }
    roundId = round.id;
  }

  await db.insert(songs).values({
    gameId: game.id,
    roundId,
    submittedByPlayerId: me.id,
    spotifyTrackId: parsed.data.spotifyTrackId,
    trackName: parsed.data.trackName,
    artistName: parsed.data.artistName,
    albumArtUrl: parsed.data.albumArtUrl,
    spotifyUrl: parsed.data.spotifyUrl,
  });

  const view = await getGameView(code, identity);
  return NextResponse.json(view, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const songId = searchParams.get("songId");
  if (!songId) {
    return NextResponse.json({ error: "songId is required" }, { status: 400 });
  }

  const access = await requireGameAndPlayer(code);
  if (isGameAccessError(access)) {
    return NextResponse.json(
      { error: access.error.message },
      { status: access.error.status },
    );
  }
  const { db, game, me, identity } = access;

  if (game.status !== "submitting") {
    return NextResponse.json(
      { error: "Submissions are closed for this game" },
      { status: 409 },
    );
  }

  const song = await db.query.songs.findFirst({
    where: eq(songs.id, songId),
  });
  if (!song || song.gameId !== game.id || song.submittedByPlayerId !== me.id) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }
  if (game.format === "party") {
    const round = await getCurrentRound(db, game.id);
    if (!round || song.roundId !== round.id) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }
  }

  await db.delete(songs).where(eq(songs.id, songId));

  const view = await getGameView(code, identity);
  return NextResponse.json(view);
}
