import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { packSignedValue, unpackSignedValue } from "@/lib/signed-value";

const GUEST_COOKIE = "tr_guest";

export type Identity =
  | { type: "user"; userId: string }
  | { type: "guest"; guestSessionId: string };

/** Read-only: safe to call from Server Components. Never mutates cookies. */
export async function readIdentity(): Promise<Identity | null> {
  const { userId } = await auth();
  if (userId) return { type: "user", userId };

  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (!existing) return null;
  const guestSessionId = unpackSignedValue(existing);
  return guestSessionId ? { type: "guest", guestSessionId } : null;
}

/**
 * Mutating: only call from Route Handlers or Server Actions. Issues a new
 * signed guest cookie if one doesn't already exist.
 */
export async function ensureIdentity(): Promise<Identity> {
  const { userId } = await auth();
  if (userId) return { type: "user", userId };

  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  const existingGuestId = existing ? unpackSignedValue(existing) : null;
  if (existingGuestId) return { type: "guest", guestSessionId: existingGuestId };

  const guestSessionId = randomUUID();
  store.set(GUEST_COOKIE, packSignedValue(guestSessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return { type: "guest", guestSessionId };
}
