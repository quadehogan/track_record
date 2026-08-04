import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { spotifyConnections } from "@/lib/db/schema";
import { exchangeCodeForToken } from "@/lib/spotify";
import { unpackSignedValue } from "@/lib/signed-value";

export async function GET(request: Request) {
  const { userId } = await auth();
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const gameCode = state ? unpackSignedValue(state) : null;
  const redirectBase = gameCode ? `${origin}/game/${gameCode}` : origin;

  if (!userId || !code || !gameCode) {
    return NextResponse.redirect(
      `${redirectBase}?spotifyError=1`,
    );
  }

  try {
    const token = await exchangeCodeForToken(code);
    const db = getDb();
    await db
      .insert(spotifyConnections)
      .values({
        userId,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      })
      .onConflictDoUpdate({
        target: spotifyConnections.userId,
        set: {
          accessToken: token.accessToken,
          refreshToken: token.refreshToken,
          expiresAt: token.expiresAt,
        },
      });
  } catch {
    return NextResponse.redirect(`${redirectBase}?spotifyError=1`);
  }

  return NextResponse.redirect(`${redirectBase}?spotifyConnected=1`);
}
