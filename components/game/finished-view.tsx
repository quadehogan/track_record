"use client";

import useSWR from "swr";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { GameView } from "@/lib/queries/game-view";
import type { PlayerScore } from "@/lib/scoring";
import { ExportPlaylistButton } from "@/components/game/export-playlist-button";
import { ResultsSongList } from "@/components/game/results-song-list";

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
      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="playlist">Playlist</TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                Ranked by accuracy (correct guesses ÷ eligible songs) — raw
                score shown alongside since late joiners have fewer eligible
                songs.
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
                    <span className="flex-1 font-medium">
                      {score.displayName}
                    </span>
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
        </TabsContent>

        <TabsContent value="playlist" className="flex flex-col gap-6">
          {view.me?.isHost && !view.me.isGuest && (
            <Card>
              <CardHeader>
                <CardTitle>Export to Spotify</CardTitle>
                <CardDescription>
                  Create a Spotify playlist with every submitted song.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportPlaylistButton code={code} view={view} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Full song list</CardTitle>
              <CardDescription>
                Grouped by who submitted each one — green means you guessed
                it right, red means you guessed wrong.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResultsSongList view={view} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button
        variant="secondary"
        nativeButton={false}
        render={<Link href="/">Back to home</Link>}
      />
    </div>
  );
}
