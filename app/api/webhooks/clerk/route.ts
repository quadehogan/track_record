import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { players, spotifyConnections } from "@/lib/db/schema";

export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "user.deleted") {
    const userId = event.data.id;
    if (userId) {
      const db = getDb();
      await db
        .delete(spotifyConnections)
        .where(eq(spotifyConnections.userId, userId));

      // Anonymize rather than delete: a hard delete would cascade to this
      // player's submitted songs and guesses, corrupting other players'
      // results in any shared game. This clears their personal identifier
      // while keeping those games' history intact for everyone else.
      await db
        .update(players)
        .set({ userId: null, displayName: "Deleted user" })
        .where(eq(players.userId, userId));
    }
  }

  return NextResponse.json({ received: true });
}
