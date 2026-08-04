"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

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
    <Combobox<SpotifyTrackResult>
      items={query.trim() ? results : []}
      filter={null}
      inputValue={query}
      onInputValueChange={(value) => setQuery(value)}
      value={null}
      onValueChange={(track) => {
        if (!track) return;
        onSelect(track);
        setQuery("");
        setResults([]);
      }}
      itemToStringValue={(track) => track.trackName}
    >
      <ComboboxInput
        placeholder="Search for a song..."
        disabled={disabled}
        showTrigger={false}
        className="w-full"
      />
      <ComboboxContent className="w-(--anchor-width)">
        <ComboboxEmpty>
          {isLoading ? "Searching..." : "No results"}
        </ComboboxEmpty>
        <ComboboxList className="min-h-[168px]">
          {(track: SpotifyTrackResult) => (
            <ComboboxItem key={track.spotifyTrackId} value={track}>
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
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
