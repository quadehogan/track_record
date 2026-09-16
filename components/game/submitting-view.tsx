"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { GameView } from "@/lib/queries/game-view";
import { SongSearchInput, type SpotifyTrackResult } from "@/components/game/song-search-input";
import { PARTY_PROMPTS } from "@/lib/prompts";

export function SubmittingView({
  code,
  view,
  onUpdate,
}: {
  code: string;
  view: GameView;
  onUpdate: (view: GameView) => void;
}) {
  if (view.game.format === "party" && view.round) {
    return <PartySubmittingView code={code} view={view} onUpdate={onUpdate} />;
  }

  return <RoadTripSubmittingView code={code} view={view} onUpdate={onUpdate} />;
}

function RoadTripSubmittingView({
  code,
  view,
  onUpdate,
}: {
  code: string;
  view: GameView;
  onUpdate: (view: GameView) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/game/${code}` : "";

  async function handleSelectTrack(track: SpotifyTrackResult) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/games/${code}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to submit song");
        return;
      }
      onUpdate(await res.json());
      toast.success(`Added "${track.trackName}"`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(songId: string) {
    const res = await fetch(`/api/games/${code}/songs?songId=${songId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to remove song");
      return;
    }
    onUpdate(await res.json());
  }

  async function handleCloseSubmissions() {
    setIsClosing(true);
    try {
      const res = await fetch(`/api/games/${code}/close-submissions`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to close submissions");
        return;
      }
      onUpdate(await res.json());
      toast.success("Submissions closed — guessing has started!");
    } finally {
      setIsClosing(false);
    }
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Share this game</CardTitle>
          <CardDescription>
            Anyone with the link or code can join and submit a song.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">
            {shareUrl}
          </code>
          <Button variant="secondary" onClick={copyShareLink}>
            Copy
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submit a song</CardTitle>
          <CardDescription>
            Your submission stays anonymous until guessing starts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SongSearchInput onSelect={handleSelectTrack} disabled={isSubmitting} />

          <div className="flex flex-col gap-2">
            {view.mySubmittedSongs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                You haven&apos;t submitted a song yet.
              </p>
            )}
            {view.mySubmittedSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                {song.albumArtUrl ? (
                  <Image
                    src={song.albumArtUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded"
                  />
                ) : (
                  <div className="size-10 shrink-0 rounded bg-muted" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {song.trackName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {song.artistName}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(song.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Players
            <Badge variant="secondary">{view.players.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <li key={p.id}>
                <Badge variant={p.isHost ? "default" : "outline"}>
                  {p.displayName}
                  {p.isHost ? " (host)" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {view.me?.isHost && (
        <Card>
          <CardHeader>
            <CardTitle>Host controls</CardTitle>
            <CardDescription>
              {view.submittedCount} song{view.submittedCount === 1 ? "" : "s"}{" "}
              submitted so far. Closing locks the song list and starts
              guessing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCloseSubmissions}
              disabled={isClosing || view.submittedCount === 0}
            >
              {isClosing ? "Closing..." : "Close submissions & start guessing"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PartySubmittingView({
  code,
  view,
  onUpdate,
}: {
  code: string;
  view: GameView;
  onUpdate: (view: GameView) => void;
}) {
  const round = view.round!;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isSettingPrompt, setIsSettingPrompt] = useState(false);

  async function handleSelectTrack(track: SpotifyTrackResult) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/games/${code}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to submit song");
        return;
      }
      onUpdate(await res.json());
      toast.success(`Added "${track.trackName}"`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(songId: string) {
    const res = await fetch(`/api/games/${code}/songs?songId=${songId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to remove song");
      return;
    }
    onUpdate(await res.json());
  }

  async function handleSetPrompt(e: React.FormEvent) {
    e.preventDefault();
    const prompt = promptText.trim();
    if (!prompt) {
      toast.error("Enter a prompt, or use a random one");
      return;
    }
    setIsSettingPrompt(true);
    try {
      const res = await fetch(`/api/games/${code}/rounds/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to set prompt");
        return;
      }
      onUpdate(await res.json());
    } finally {
      setIsSettingPrompt(false);
    }
  }

  function useRandomPrompt() {
    const pick =
      PARTY_PROMPTS[Math.floor(Math.random() * PARTY_PROMPTS.length)];
    setPromptText(pick);
  }

  const [isClosing, setIsClosing] = useState(false);

  async function handleCloseRound() {
    setIsClosing(true);
    try {
      const res = await fetch(`/api/games/${code}/close-submissions`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to close this round");
        return;
      }
      onUpdate(await res.json());
      toast.success("Round submissions closed — guessing has started!");
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Round {round.roundIndex + 1} of {round.totalRounds}
      </p>

      {round.status === "awaiting_prompt" && round.isMyTurn && (
        <Card>
          <CardHeader>
            <CardTitle>Set this round&apos;s prompt</CardTitle>
            <CardDescription>
              Write your own, or grab a random one to start from.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form onSubmit={handleSetPrompt} className="flex flex-col gap-3">
              <Input
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g. Songs to get ready to"
                maxLength={200}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={useRandomPrompt}>
                  🎲 Random prompt
                </Button>
                <Button type="submit" disabled={isSettingPrompt} className="ml-auto">
                  {isSettingPrompt ? "Setting..." : "Set prompt"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {round.status === "awaiting_prompt" && !round.isMyTurn && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Waiting for {round.promptSetterDisplayName} to set this
            round&apos;s prompt.
          </CardContent>
        </Card>
      )}

      {round.status === "submitting" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>This round&apos;s prompt</CardTitle>
              <CardDescription className="text-base text-foreground">
                &ldquo;{round.prompt}&rdquo;
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Submit a song</CardTitle>
              <CardDescription>
                One song per round — it stays anonymous until guessing starts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {view.mySubmittedSongs.length === 0 && (
                <SongSearchInput
                  onSelect={handleSelectTrack}
                  disabled={isSubmitting}
                />
              )}
              {view.mySubmittedSongs.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 rounded-lg border p-2"
                >
                  {song.albumArtUrl ? (
                    <Image
                      src={song.albumArtUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded bg-muted" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {song.trackName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {song.artistName}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(song.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Players
            <Badge variant="secondary">{view.players.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <li key={p.id}>
                <Badge variant={p.isHost ? "default" : "outline"}>
                  {p.displayName}
                  {p.isHost ? " (host)" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {view.me?.isHost && round.status === "submitting" && (
        <Card>
          <CardHeader>
            <CardTitle>Host controls</CardTitle>
            <CardDescription>
              {view.submittedCount} of {view.players.length} songs submitted
              this round. Closing locks this round&apos;s songs and starts
              guessing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCloseRound}
              disabled={isClosing || view.submittedCount === 0}
            >
              {isClosing ? "Closing..." : "Close round & start guessing"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
