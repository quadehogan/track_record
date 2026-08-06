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

const GUESSING_MODES = [
  {
    value: "all_at_once",
    label: "All at once",
    description: "Every song is available to guess as soon as submissions close.",
  },
  {
    value: "drip",
    label: "Drip",
    description: "Songs unlock one at a time as the host advances the game.",
  },
] as const;

const REVEAL_MODES = [
  {
    value: "immediate",
    label: "Immediate",
    description: "See who submitted a song right after you guess it.",
  },
  {
    value: "end_of_song",
    label: "End of song",
    description: "The answer reveals once everyone has guessed, or the host advances.",
  },
  {
    value: "end_of_game",
    label: "End of game",
    description: "No reveals until the host ends the whole game.",
  },
] as const;

export default function CreateGamePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [hostDisplayName, setHostDisplayName] = useState("");
  const [guessingMode, setGuessingMode] =
    useState<(typeof GUESSING_MODES)[number]["value"]>("all_at_once");
  const [revealMode, setRevealMode] =
    useState<(typeof REVEAL_MODES)[number]["value"]>("immediate");
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
          guessingMode,
          revealMode,
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
              Configure how submissions and guessing will work. Players join
              async via a link or code once you&apos;re done.
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
              <Label>Guessing mode</Label>
              <RadioGroup
                value={guessingMode}
                onValueChange={(value) =>
                  setGuessingMode(value as typeof guessingMode)
                }
              >
                {GUESSING_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className="flex items-start gap-3 rounded-lg border p-3 has-data-checked:border-primary"
                  >
                    <RadioGroupItem value={mode.value} className="mt-1" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{mode.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {mode.description}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-3">
              <Label>Reveal mode</Label>
              <RadioGroup
                value={revealMode}
                onValueChange={(value) =>
                  setRevealMode(value as typeof revealMode)
                }
              >
                {REVEAL_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className="flex items-start gap-3 rounded-lg border p-3 has-data-checked:border-primary"
                  >
                    <RadioGroupItem value={mode.value} className="mt-1" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{mode.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {mode.description}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
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
