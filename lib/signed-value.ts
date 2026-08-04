import { createHmac, timingSafeEqual } from "crypto";

function sign(value: string): string {
  return createHmac("sha256", process.env.GUEST_SESSION_SECRET!)
    .update(value)
    .digest("hex");
}

export function packSignedValue(value: string): string {
  return `${value}.${sign(value)}`;
}

export function unpackSignedValue(packed: string): string | null {
  const [value, sig] = packed.split(".");
  if (!value || !sig) return null;
  const expected = sign(value);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}
