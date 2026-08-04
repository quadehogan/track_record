"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import Image from "next/image";

export interface SpotifyTrackResult {
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumArtUrl: string | null;
  spotifyUrl: string;
}

export function SongSearchInput({
  onSelect,
  disabled,
}: {
  onSelect: (track: SpotifyTrackResult) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrackResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // The dropdown itself is gated on query.trim() in the JSX below, so an
    // empty query just needs to skip scheduling a search — no state to clear.
    if (!query.trim()) return;

    // Flip the loading indicator immediately on keystroke; the actual fetch
    // is deliberately deferred by the debounce timer below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      try {
        const res = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(query)}`,
        );
        const data = await res.json();
        if (requestId === requestIdRef.current) {
          setResults(data.results ?? []);
        }
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <Input
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Search for a song..."
      />
      {isOpen && query.trim() && (
        <div className="absolute z-10 mt-1 max-h-80 min-h-[168px] w-full overflow-y-auto rounded-lg border bg-popover shadow-md">
          {isLoading && (
            <div className="p-3 text-sm text-muted-foreground">
              Searching...
            </div>
          )}
          {!isLoading && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">
              No results
            </div>
          )}
          {results.map((track) => (
            <button
              key={track.spotifyTrackId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(track);
                setQuery("");
                setResults([]);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-3 p-2 text-left hover:bg-accent"
            >
              {track.albumArtUrl ? (
                <Image
                  src={track.albumArtUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded"
                />
              ) : (
                <div className="size-10 shrink-0 rounded bg-muted" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {track.trackName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {track.artistName}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
