import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthorizeUrl } from "@/lib/spotify";
import { packSignedValue } from "@/lib/signed-value";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to connect Spotify" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("gameCode");
  if (!code) {
    return NextResponse.json({ error: "gameCode is required" }, { status: 400 });
  }

  const state = packSignedValue(code.toUpperCase());
  return NextResponse.redirect(getAuthorizeUrl(state));
}
