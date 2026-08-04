import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { games, players, type Game, type Player } from "@/lib/db/schema";
import { readIdentity, type Identity } from "@/lib/session";

export interface GameAccessError {
  error: { message: string; status: number };
}

export interface GameAccess {
  db: ReturnType<typeof getDb>;
  game: Game;
  me: Player;
  identity: Identity;
  allPlayers: Player[];
}

/** Resolves the current identity's Player row for a game, or a typed error to return as-is. */
export async function requireGameAndPlayer(
  code: string,
): Promise<GameAccess | GameAccessError> {
  const identity = await readIdentity();
  if (!identity) {
    return { error: { message: "Not signed in", status: 401 } };
  }

  const db = getDb();
  const game = await db.query.games.findFirst({
    where: eq(games.code, code.toUpperCase()),
  });
  if (!game) {
    return { error: { message: "Game not found", status: 404 } };
  }

  const allPlayers = await db.query.players.findMany({
    where: eq(players.gameId, game.id),
  });
  const me = allPlayers.find((p) =>
    identity.type === "user"
      ? p.userId === identity.userId
      : p.guestSessionId === identity.guestSessionId,
  );
  if (!me) {
    return { error: { message: "Join the game before doing that", status: 403 } };
  }

  return { db, game, me, identity, allPlayers };
}

export function isGameAccessError(
  result: GameAccess | GameAccessError,
): result is GameAccessError {
  return "error" in result;
}
