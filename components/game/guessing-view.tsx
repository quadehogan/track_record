"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { toast } from "sonner";
import type { GameView, GameViewSong } from "@/lib/queries/game-view";

export function GuessingView({
  code,
  view,
  onUpdate,
}: {
  code: string;
  view: GameView;
  onUpdate: (view: GameView) => void;
}) {
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  async function callApi(path: string, body?: unknown) {
    const res = await fetch(`/api/games/${code}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Something went wrong");
      return null;
    }
    return res.json();
  }

  async function handleAdvance(action: "next" | "open" | "close") {
    setIsAdvancing(true);
    try {
      const view = await callApi("/advance", { action });
      if (view) onUpdate(view);
    } finally {
      setIsAdvancing(false);
    }
  }

  async function handleFinish() {
    setIsFinishing(true);
    try {
      const view = await callApi("/finish");
      if (view) onUpdate(view);
    } finally {
      setIsFinishing(false);
    }
  }

  const hasOpenSong = view.songs.some((s) => s.unlockState === "open");
  const hasLockedSong = view.songs.some((s) => s.unlockState === "locked");

  return (
    <div className="flex flex-col gap-6">
      {view.me?.isHost && view.game.guessingMode !== "all_at_once" && (
        <Card>
          <CardHeader>
            <CardTitle>Host controls</CardTitle>
            <CardDescription>
              {view.game.guessingMode === "drip"
                ? "Advance to the next song when everyone is ready."
                : "Open a song, let people guess, then close it before opening the next."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex gap-2">
            {view.game.guessingMode === "drip" && (
              <Button
                onClick={() => handleAdvance("next")}
                disabled={isAdvancing || !hasLockedSong}
              >
                Next song
              </Button>
            )}
            {view.game.guessingMode === "host_paced" && (
              <>
                <Button
                  onClick={() => handleAdvance("open")}
                  disabled={isAdvancing || hasOpenSong || !hasLockedSong}
                >
                  Open next song
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleAdvance("close")}
                  disabled={isAdvancing || !hasOpenSong}
                >
                  Close current song
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {view.songs.map((song, i) => (
          <SongGuessCard
            key={song.id}
            code={code}
            song={song}
            position={i + 1}
            players={view.players}
            myPlayerId={view.me?.id ?? null}
            onGuessed={onUpdate}
          />
        ))}
      </div>

      {view.me?.isHost && (
        <Card>
          <CardHeader>
            <CardTitle>End the game</CardTitle>
            <CardDescription>
              Locks in results for everyone. You can do this anytime.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              variant="destructive"
              onClick={handleFinish}
              disabled={isFinishing}
            >
              {isFinishing ? "Ending..." : "End game & show results"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function SongGuessCard({
  code,
  song,
  position,
  players,
  myPlayerId,
  onGuessed,
}: {
  code: string;
  song: GameViewSong;
  position: number;
  players: GameView["players"];
  myPlayerId: string | null;
  onGuessed: (view: GameView) => void;
}) {
  const [isGuessing, setIsGuessing] = useState(false);

  async function submitGuess(guessedPlayerId: string) {
    setIsGuessing(true);
    try {
      const res = await fetch(`/api/games/${code}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id, guessedPlayerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to submit guess");
        return;
      }
      onGuessed(await res.json());
    } finally {
      setIsGuessing(false);
    }
  }

  const hasGuessed = song.myGuessedPlayerId !== null;
  const isGuessable = song.eligible && song.unlockState === "open" && !hasGuessed;
  const wasMissed =
    song.eligible && song.unlockState === "closed" && !hasGuessed;

  return (
    <Card className={!song.eligible ? "opacity-60" : ""}>
      <CardContent className="flex items-center gap-4">
        <span className="w-6 shrink-0 text-center text-sm text-muted-foreground">
          {position}
        </span>
        {song.albumArtUrl ? (
          <Image
            src={song.albumArtUrl}
            alt=""
            width={56}
            height={56}
            className="rounded"
          />
        ) : (
          <div className="size-14 shrink-0 rounded bg-muted" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="truncate font-medium">{song.trackName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {song.artistName}
            </p>
          </div>

          {!song.eligible && (
            <Badge variant="outline" className="w-fit">
              Unlocked before you joined
            </Badge>
          )}

          {song.eligible && song.unlockState === "locked" && (
            <Badge variant="outline" className="w-fit">
              Not unlocked yet
            </Badge>
          )}

          {wasMissed && (
            <Badge variant="outline" className="w-fit">
              Closed — you didn&apos;t guess in time
            </Badge>
          )}

          {hasGuessed && !song.revealedSubmitter && (
            <Badge variant="secondary" className="w-fit">
              Guess submitted — waiting on reveal
            </Badge>
          )}

          {song.revealedSubmitter && (
            <Badge
              variant={
                song.myGuessedPlayerId === song.revealedSubmitter.playerId
                  ? "default"
                  : "outline"
              }
              className="w-fit"
            >
              Submitted by {song.revealedSubmitter.displayName}
              {myPlayerId &&
                (song.myGuessedPlayerId === song.revealedSubmitter.playerId
                  ? " — you got it right!"
                  : song.myGuessedPlayerId
                    ? " — not your guess"
                    : "")}
            </Badge>
          )}

          {isGuessable && (
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="outline"
                  disabled={isGuessing}
                  onClick={() => submitGuess(p.id)}
                >
                  {p.displayName}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
