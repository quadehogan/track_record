"use client";

import useSWR from "swr";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { GameView } from "@/lib/queries/game-view";
import type { PlayerScore } from "@/lib/scoring";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function FinishedView({
  code,
  view,
}: {
  code: string;
  view: GameView;
}) {
  const { data } = useSWR<{ scores: PlayerScore[] }>(
    `/api/games/${code}/results`,
    fetcher,
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Ranked by accuracy (correct guesses ÷ eligible songs) — raw score
            shown alongside since late joiners have fewer eligible songs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2">
            {data?.scores.map((score, i) => (
              <li
                key={score.playerId}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{score.displayName}</span>
                <Badge variant="secondary">
                  {Math.round(score.accuracy * 100)}% accuracy
                </Badge>
                <Badge variant="outline">
                  {score.rawScore}/{score.eligibleSongs} correct
                </Badge>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <PlaylistCard code={code} view={view} />

      <Button
        variant="secondary"
        nativeButton={false}
        render={<Link href="/">Back to home</Link>}
      />
    </div>
  );
}

function PlaylistCard({ code, view }: { code: string; view: GameView }) {
  const [isExporting, setIsExporting] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);

  function handleConnectSpotify() {
    // Full navigation on purpose: this route redirects off-domain to Spotify's
    // OAuth authorize page, not to another page within this app.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/spotify/connect?gameCode=${code}`;
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/games/${code}/export-playlist`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to export playlist");
        return;
      }
      setPlaylistUrl(data.playlistUrl);
      toast.success("Playlist created on Spotify!");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>The full playlist</CardTitle>
        <CardDescription>
          {view.me?.isHost
            ? "Export straight to Spotify, or just use the list below."
            : "Open each track in Spotify, Apple Music, or YouTube."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {view.me?.isHost && (
          <div className="flex items-center gap-2">
            {playlistUrl ? (
              <Button
                nativeButton={false}
                render={
                  <a
                    href={playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open playlist on Spotify
                  </a>
                }
              />
            ) : view.me.spotifyConnected ? (
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? "Exporting..." : "Export to Spotify"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={handleConnectSpotify}>
                Connect Spotify to export
              </Button>
            )}
          </div>
        )}

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
