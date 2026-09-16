"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GameView, GameViewSong } from "@/lib/queries/game-view";

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

export function ResultsSongList({ view }: { view: GameView }) {
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
                    "flex items-center gap-3 rounded-lg border p-2 ring-1 ring-transparent",
                    isCorrect && "bg-success-bg text-success-foreground ring-success/25",
                    isIncorrect && "bg-destructive/8 ring-destructive/25",
                  )}
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
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
