import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthorizeUrl } from "@/lib/spotify";
import { packSignedValue } from "@/lib/signed-value";

export async function GET(request: Request) {
  const { userId } = await auth();
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("gameCode");

  if (!code) {
    return NextResponse.json({ error: "gameCode is required" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.redirect(
      `${origin}/game/${code.toUpperCase()}?spotifyError=signin`,
    );
  }

  const state = packSignedValue(code.toUpperCase());
  return NextResponse.redirect(getAuthorizeUrl(state));
}
