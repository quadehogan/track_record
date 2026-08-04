import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { songs, spotifyConnections } from "@/lib/db/schema";
import { requireGameAndPlayer, isGameAccessError } from "@/lib/queries/game-access";
import { sortSongsByIndex } from "@/lib/game-state";
import {
  refreshUserAccessToken,
  getSpotifyProfileId,
  createPlaylist,
  addTracksToPlaylist,
} from "@/lib/spotify";

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
      { error: "Only the host can export the playlist" },
      { status: 403 },
    );
  }
  if (identity.type !== "user") {
    return NextResponse.json(
      { error: "Sign in and connect Spotify to export a playlist" },
      { status: 403 },
    );
  }

  const connection = await db.query.spotifyConnections.findFirst({
    where: eq(spotifyConnections.userId, identity.userId),
  });
  if (!connection) {
    return NextResponse.json(
      { error: "Connect your Spotify account first" },
      { status: 403 },
    );
  }

  const allSongs = sortSongsByIndex(
    await db.query.songs.findMany({ where: eq(songs.gameId, game.id) }),
  );
  if (allSongs.length === 0) {
    return NextResponse.json({ error: "No songs to export" }, { status: 400 });
  }

  try {
    // Spotify access tokens are short-lived; always refresh to avoid a stale-token failure mid-export.
    const refreshed = await refreshUserAccessToken(connection.refreshToken);
    await db
      .update(spotifyConnections)
      .set({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
      })
      .where(eq(spotifyConnections.userId, identity.userId));

    const profileId = await getSpotifyProfileId(refreshed.accessToken);
    const playlist = await createPlaylist(
      refreshed.accessToken,
      profileId,
      `Track Record — ${game.code}`,
    );
    await addTracksToPlaylist(
      refreshed.accessToken,
      playlist.id,
      allSongs.map((s) => s.spotifyTrackId),
    );

    return NextResponse.json({ playlistUrl: playlist.url });
  } catch {
    return NextResponse.json(
      { error: "Failed to export playlist to Spotify" },
      { status: 502 },
    );
  }
}
