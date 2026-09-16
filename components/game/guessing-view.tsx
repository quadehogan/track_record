"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { GameView, GameViewSong } from "@/lib/queries/game-view";
import { PlaylistCard } from "@/components/game/playlist-card";

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

  async function handleAdvance() {
    setIsAdvancing(true);
    try {
      const view = await callApi("/advance", { action: "next" });
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

  const hasLockedSong = view.songs.some((s) => s.unlockState === "locked");
  const isLastRound =
    !view.round || view.round.roundIndex + 1 >= view.round.totalRounds;

  return (
    <div className="flex flex-col gap-6">
      {view.round && (
        <div>
          <p className="text-sm text-muted-foreground">
            Round {view.round.roundIndex + 1} of {view.round.totalRounds}
          </p>
          <p className="text-base font-medium">
            &ldquo;{view.round.prompt}&rdquo;
          </p>
        </div>
      )}

      <Tabs defaultValue="guess">
        <TabsList>
          <TabsTrigger value="guess">Guess</TabsTrigger>
          <TabsTrigger value="playlist">Playlist</TabsTrigger>
        </TabsList>

        <TabsContent value="guess">
          <GuessBoard code={code} view={view} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="playlist">
          <PlaylistCard code={code} view={view} />
        </TabsContent>
      </Tabs>

      {view.me?.isHost && (
        <Card>
          <CardHeader>
            <CardTitle>Host controls</CardTitle>
            {view.game.guessingMode === "drip" && (
              <CardDescription>
                Advance to the next song when everyone is ready.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <span
                key={p.id}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  p.guessProgress.total > 0 &&
                    p.guessProgress.done === p.guessProgress.total
                    ? "border-success/40 bg-success-bg text-success-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {p.displayName} {p.guessProgress.done}/{p.guessProgress.total}
              </span>
            ))}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            {view.game.guessingMode === "drip" && (
              <Button
                onClick={handleAdvance}
                disabled={isAdvancing || !hasLockedSong}
              >
                Next song
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleFinish}
              disabled={isFinishing}
              className="ml-auto"
            >
              {isFinishing
                ? "Ending..."
                : isLastRound
                  ? "End game & show results"
                  : "End round & continue"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function GuessBoard({
  code,
  view,
  onUpdate,
}: {
  code: string;
  view: GameView;
  onUpdate: (view: GameView) => void;
}) {
  const [pendingSongId, setPendingSongId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [justRevealedIds, setJustRevealedIds] = useState<Set<string>>(
    new Set(),
  );
  const revealedIdsRef = useRef<Set<string>>(new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    const currentlyRevealed = new Set(
      view.songs.filter((s) => s.revealedSubmitter).map((s) => s.id),
    );
    const newlyRevealed = new Set(
      [...currentlyRevealed].filter((id) => !revealedIdsRef.current.has(id)),
    );
    revealedIdsRef.current = currentlyRevealed;
    if (newlyRevealed.size === 0) return;
    setJustRevealedIds(newlyRevealed);
    const timeout = setTimeout(() => setJustRevealedIds(new Set()), 500);
    return () => clearTimeout(timeout);
  }, [view.songs]);

  const eligibleSongs = view.songs.filter((s) => s.eligible);
  const queue = eligibleSongs.filter(
    (s) =>
      s.unlockState === "open" &&
      s.myGuessedPlayerId === null &&
      !s.revealedSubmitter,
  );
  const staged = queue[0] ?? null;
  const missed = eligibleSongs.filter(
    (s) => s.unlockState === "closed" && s.myGuessedPlayerId === null,
  );

  const placedByPlayer = new Map<string, GameViewSong[]>();
  for (const s of eligibleSongs) {
    if (s.myGuessedPlayerId) {
      const arr = placedByPlayer.get(s.myGuessedPlayerId) ?? [];
      arr.push(s);
      placedByPlayer.set(s.myGuessedPlayerId, arr);
    }
  }

  const activeSong = activeSongId
    ? (view.songs.find((s) => s.id === activeSongId) ?? null)
    : null;

  async function submitGuess(songId: string, guessedPlayerId: string) {
    setPendingSongId(songId);
    try {
      const res = await fetch(`/api/games/${code}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, guessedPlayerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to submit guess");
        return;
      }
      onUpdate(await res.json());
    } finally {
      setPendingSongId(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveSongId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveSongId(null);
    const { active, over } = event;
    if (!over) return;
    const songId = String(active.id);
    const guessedPlayerId = String(over.id);
    const song = view.songs.find((s) => s.id === songId);
    if (!song || song.myGuessedPlayerId === guessedPlayerId) return;
    submitGuess(songId, guessedPlayerId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveSongId(null)}
    >
      <div className="flex flex-col gap-4">
        {staged ? (
          <StagedSong
            song={staged}
            disabled={pendingSongId === staged.id}
          />
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {eligibleSongs.some((s) => s.unlockState === "locked")
                ? "Waiting for the host to unlock the next song."
                : "You've placed a guess for every song open so far."}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {view.players.map((p) => (
            <PlayerBucket
              key={p.id}
              player={p}
              songs={placedByPlayer.get(p.id) ?? []}
              pendingSongId={pendingSongId}
              justRevealedIds={justRevealedIds}
            />
          ))}
        </div>

        {missed.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Closed before you guessed: {missed.map((s) => s.trackName).join(", ")}
          </p>
        )}
      </div>

      <DragOverlay>
        {activeSong ? <SongThumb song={activeSong} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function SongArt({ song, size = 56 }: { song: GameViewSong; size?: number }) {
  return song.albumArtUrl ? (
    <Image
      src={song.albumArtUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded"
    />
  ) : (
    <div
      className="shrink-0 rounded bg-muted"
      style={{ width: size, height: size }}
    />
  );
}

function SongThumb({ song }: { song: GameViewSong }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card p-2 shadow-md">
      <SongArt song={song} size={40} />
      <span className="max-w-40 truncate text-sm font-medium">
        {song.trackName}
      </span>
    </div>
  );
}

function StagedSong({
  song,
  disabled,
}: {
  song: GameViewSong;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: song.id,
    disabled,
  });

  return (
    <Card>
      <CardContent
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{ touchAction: "none" }}
        className={cn(
          "flex cursor-grab items-center gap-4 active:cursor-grabbing",
          isDragging && "opacity-40",
        )}
      >
        <SongArt song={song} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{song.trackName}</p>
          <p className="truncate text-sm text-muted-foreground">
            {song.artistName}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Drag onto who you think submitted it
        </p>
      </CardFooter>
    </Card>
  );
}

function PlayerBucket({
  player,
  songs,
  pendingSongId,
  justRevealedIds,
}: {
  player: GameView["players"][number];
  songs: GameViewSong[];
  pendingSongId: string | null;
  justRevealedIds: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: player.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-28 flex-col gap-2 rounded-lg border-2 border-dashed p-2 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <p className="truncate text-xs font-medium text-muted-foreground">
        {player.displayName}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {songs.map((s) => (
          <PlacedSong
            key={s.id}
            song={s}
            disabled={pendingSongId === s.id}
            justRevealed={justRevealedIds.has(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PlacedSong({
  song,
  disabled,
  justRevealed,
}: {
  song: GameViewSong;
  disabled: boolean;
  justRevealed: boolean;
}) {
  const editable = song.unlockState === "open" && !song.revealedSubmitter;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: song.id,
    disabled: disabled || !editable,
  });

  return (
    <div
      ref={setNodeRef}
      {...(editable ? listeners : {})}
      {...(editable ? attributes : {})}
      style={{ touchAction: "none" }}
      title={`${song.trackName} — ${song.artistName}`}
      className={cn(
        "size-10 shrink-0 overflow-hidden rounded",
        editable ? "cursor-grab active:cursor-grabbing" : "opacity-70",
        isDragging && "opacity-40",
        song.revealedSubmitter &&
          (song.myGuessedPlayerId === song.revealedSubmitter.playerId
            ? "ring-2 ring-success"
            : "ring-2 ring-destructive"),
        justRevealed && "animate-reveal-pop",
      )}
    >
      <SongArt song={song} size={40} />
    </div>
  );
}
