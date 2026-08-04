"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { GameView } from "@/lib/queries/game-view";
import { ExportPlaylistButton } from "@/components/game/export-playlist-button";

export function PlaylistCard({
  code,
  view,
}: {
  code: string;
  view: GameView;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The full playlist</CardTitle>
        <CardDescription>
          {view.me?.isHost
            ? "Export straight to Spotify so everyone can listen while they guess, or just use the list below."
            : "Open each track in Spotify, Apple Music, or YouTube."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ExportPlaylistButton code={code} view={view} />

        <ol className="flex flex-col gap-2">
          {view.songs.map((song, i) => (
            <li
              key={song.id}
              className="flex items-center gap-3 rounded-lg border p-2"
            >
              <span className="w-5 text-center text-xs text-muted-foreground">
                {i + 1}
              </span>
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
                  {song.revealedSubmitter
                    ? ` · submitted by ${song.revealedSubmitter.displayName}`
                    : ""}
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
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
