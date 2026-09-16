"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import type { GameView } from "@/lib/queries/game-view";
import { SubmittingView } from "@/components/game/submitting-view";
import { GuessingView } from "@/components/game/guessing-view";
import { FinishedView } from "@/components/game/finished-view";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function GameScreen({
  code,
  initialView,
}: {
  code: string;
  initialView: GameView;
}) {
  const { data: view, mutate } = useSWR<GameView>(`/api/games/${code}`, fetcher, {
    fallbackData: initialView,
    refreshInterval: 4000,
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const spotifyConnected = searchParams.get("spotifyConnected");
    const spotifyError = searchParams.get("spotifyError");
    if (!spotifyConnected && !spotifyError) return;

    if (spotifyConnected) {
      toast.success("Spotify connected!");
      mutate();
    } else if (spotifyError === "signin") {
      toast.error("Sign in with a real account to connect Spotify");
    } else {
      toast.error("Failed to connect Spotify");
    }
    router.replace(`/game/${code}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (!view) return null;

  if (!view.me) {
    return <JoinForm code={code} onJoined={(v) => mutate(v, false)} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Game code</p>
          <p className="font-mono text-lg font-semibold tracking-wider">
            {view.game.code}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Playing as <span className="font-medium">{view.me.displayName}</span>
        </p>
      </header>

      {view.game.status === "submitting" && (
        <SubmittingView code={code} view={view} onUpdate={(v) => mutate(v, false)} />
      )}
      {view.game.status === "guessing" && (
        <GuessingView code={code} view={view} onUpdate={(v) => mutate(v, false)} />
      )}
      {view.game.status === "finished" && (
        <FinishedView code={code} view={view} onUpdate={(v) => mutate(v, false)} />
      )}
    </div>
  );
}

function JoinForm({
  code,
  onJoined,
}: {
  code: string;
  onJoined: (view: GameView) => void;
}) {
  const { user, isLoaded } = useUser();
  const [displayName, setDisplayName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const defaultName = isLoaded ? (user?.firstName ?? user?.username ?? "") : "";

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const name = displayName.trim() || defaultName;
    if (!name) {
      toast.error("Enter a display name");
      return;
    }
    setIsJoining(true);
    try {
      const res = await fetch(`/api/games/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to join game");
        return;
      }
      onJoined(await res.json());
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={handleJoin} className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Join game {code}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Your display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={defaultName || "e.g. Sam"}
                maxLength={40}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={isJoining}>
              {isJoining ? "Joining..." : "Join"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
