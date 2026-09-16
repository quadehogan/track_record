import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rounds } from "@/lib/db/schema";

/** The most recently created round is always the active one — rounds are never deleted. */
export async function getCurrentRound(db: ReturnType<typeof getDb>, gameId: string) {
  return db.query.rounds.findFirst({
    where: eq(rounds.gameId, gameId),
    orderBy: desc(rounds.roundIndex),
  });
}
