"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

const FORMATS = [
  {
    value: "road_trip",
    label: "Road trip",
    description: "One big shared playlist — everyone submits songs, then guess who submitted what, at your own pace.",
  },
  {
    value: "party",
    label: "Party",
    description: "Play in rounds. Each round someone sets a prompt (like \"songs to get ready to\"), everyone submits a song to match, then you guess.",
  },
] as const;

export default function CreateGamePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [hostDisplayName, setHostDisplayName] = useState("");
  const [format, setFormat] =
    useState<(typeof FORMATS)[number]["value"]>("road_trip");
  const [totalRounds, setTotalRounds] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultName = isLoaded
    ? (user?.firstName ?? user?.username ?? "")
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = hostDisplayName.trim() || defaultName;
    if (!name) {
      toast.error("Enter a display name");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostDisplayName: name,
          format,
          totalRounds: format === "party" ? totalRounds : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error?.formErrors?.[0] ?? "Failed to create game");
        return;
      }
      const { code } = await res.json();
      router.push(`/game/${code}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Create a game</CardTitle>
            <CardDescription>
              Players join async via a link or code once you&apos;re done.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="hostDisplayName">Your display name</Label>
              <Input
                id="hostDisplayName"
                value={hostDisplayName}
                onChange={(e) => setHostDisplayName(e.target.value)}
                placeholder={defaultName || "e.g. Sam"}
                maxLength={40}
              />
            </div>

            <div className="flex flex-col gap-3">
              <Label>Game type</Label>
              <RadioGroup
                value={format}
                onValueChange={(value) => setFormat(value as typeof format)}
              >
                {FORMATS.map((f) => (
                  <label
                    key={f.value}
                    className="flex items-start gap-3 rounded-lg border p-3 has-data-checked:border-primary"
                  >
                    <RadioGroupItem value={f.value} className="mt-1" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{f.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.description}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {format === "party" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="totalRounds">Number of rounds</Label>
                <Input
                  id="totalRounds"
                  type="number"
                  min={1}
                  max={20}
                  value={totalRounds}
                  onChange={(e) =>
                    setTotalRounds(
                      Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                  className="max-w-24"
                />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Creating..." : "Create game"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
