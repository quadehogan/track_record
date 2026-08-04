"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { GameView } from "@/lib/queries/game-view";

export function ExportPlaylistButton({
  code,
  view,
}: {
  code: string;
  view: GameView;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);

  if (!view.me?.isHost || view.me.isGuest) return null;

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

  if (playlistUrl) {
    return (
      <Button
        nativeButton={false}
        render={
          <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
            Open playlist on Spotify
          </a>
        }
      />
    );
  }

  if (view.me.spotifyConnected) {
    return (
      <Button onClick={handleExport} disabled={isExporting}>
        {isExporting ? "Exporting..." : "Export to Spotify"}
      </Button>
    );
  }

  return (
    <Button variant="secondary" onClick={handleConnectSpotify}>
      Connect Spotify to export
    </Button>
  );
}
