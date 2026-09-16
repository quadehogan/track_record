"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameView, GameViewSong } from "@/lib/queries/game-view";

const REACTIONS = ["🔥", "😂", "❤️", "😮", "🎯", "👎"] as const;

interface SubmitterGroup {
  playerId: string;
  displayName: string;
  songs: GameViewSong[];
}

function groupSongsBySubmitter(songs: GameViewSong[]): SubmitterGroup[] {
  const groups = new Map<string, SubmitterGroup>();
  for (const song of songs) {
    const playerId = song.revealedSubmitter?.playerId ?? "unknown";
    const displayName = song.revealedSubmitter?.displayName ?? "Unknown";
    if (!groups.has(playerId)) {
      groups.set(playerId, { playerId, displayName, songs: [] });
    }
    groups.get(playerId)!.songs.push(song);
  }
  return [...groups.values()];
}

export function ResultsSongList({
  code,
  view,
  onUpdate,
}: {
  code: string;
  view: GameView;
  onUpdate: (view: GameView) => void;
}) {
  const groups = groupSongsBySubmitter(view.songs);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <div
          key={group.playerId}
          className="flex flex-col gap-2 rounded-lg border p-3"
        >
          <p className="truncate text-xs font-medium text-muted-foreground">
            {group.displayName}
          </p>
          <ol className="flex flex-col gap-2">
            {group.songs.map((song) => {
              const isCorrect =
                song.myGuessedPlayerId !== null &&
                song.myGuessedPlayerId === song.revealedSubmitter?.playerId;
              const isIncorrect =
                song.myGuessedPlayerId !== null &&
                song.myGuessedPlayerId !== song.revealedSubmitter?.playerId;

              return (
                <li
                  key={song.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-2 ring-1 ring-transparent",
                    isCorrect && "bg-success-bg text-success-foreground ring-success/25",
                    isIncorrect && "bg-destructive/8 ring-destructive/25",
                  )}
                >
                  <div className="flex items-center gap-3">
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
                      nativeButton={false}
                      render={
                        <a
                          href={song.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      }
                    />
                  </div>
                  <SongReactions code={code} song={song} onUpdate={onUpdate} />
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function SongReactions({
  code,
  song,
  onUpdate,
}: {
  code: string;
  song: GameViewSong;
  onUpdate: (view: GameView) => void;
}) {
  const [isSending, setIsSending] = useState(false);

  async function react(emoji: string) {
    setIsSending(true);
    try {
      const nextEmoji = song.myReaction === emoji ? null : emoji;
      const res = await fetch(`/api/games/${code}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id, emoji: nextEmoji }),
      });
      if (res.ok) onUpdate(await res.json());
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {REACTIONS.map((emoji) => {
        const count = song.reactions.find((r) => r.emoji === emoji)?.count ?? 0;
        const mine = song.myReaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            disabled={isSending}
            onClick={() => react(emoji)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
              mine ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            <span>{emoji}</span>
            {count > 0 && (
              <span className="text-muted-foreground">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
