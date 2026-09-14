"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const { isSignedIn, isLoaded } = useUser();

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) router.push(`/game/${trimmed}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 p-6">
      <div className="absolute top-4 right-4 flex items-center gap-3">
        {isLoaded && isSignedIn && (
          <>
            <Link
              href="/account"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Account
            </Link>
            <UserButton />
          </>
        )}
        {isLoaded && !isSignedIn && (
          <SignInButton>
            <Button variant="outline" size="sm">
              Sign in
            </Button>
          </SignInButton>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Track Record</h1>
        <p className="max-w-md text-muted-foreground">
          An async, group music-guessing game. Submit a song anonymously, then
          guess who submitted what.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/game/create">Create a game</Link>}
        />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or join one
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleJoin} className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter game code"
            className="uppercase"
            maxLength={8}
          />
          <Button type="submit" variant="secondary">
            Join
          </Button>
        </form>
      </div>

      <Link
        href="/privacy"
        className="absolute bottom-4 text-xs text-muted-foreground hover:text-foreground"
      >
        Privacy policy
      </Link>
    </div>
  );
}
