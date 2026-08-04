import { describe, it, expect } from "vitest";
import {
  isSongEligibleForPlayer,
  countEligibleSongs,
  computePlayerScore,
  rankPlayerScores,
} from "./scoring";

describe("isSongEligibleForPlayer", () => {
  it("is ineligible for songs before the join point", () => {
    expect(isSongEligibleForPlayer(1, 3)).toBe(false);
  });

  it("is eligible for songs at or after the join point", () => {
    expect(isSongEligibleForPlayer(3, 3)).toBe(true);
    expect(isSongEligibleForPlayer(5, 3)).toBe(true);
  });

  it("is ineligible for songs with no assigned index yet", () => {
    expect(isSongEligibleForPlayer(null, 0)).toBe(false);
  });
});

describe("countEligibleSongs", () => {
  it("counts only songs from the join point forward", () => {
    const indices = [0, 1, 2, 3, 4];
    expect(countEligibleSongs(indices, 0)).toBe(5);
    expect(countEligibleSongs(indices, 3)).toBe(2);
    expect(countEligibleSongs(indices, 5)).toBe(0);
  });
});

describe("computePlayerScore", () => {
  it("computes accuracy as correct / eligible", () => {
    const score = computePlayerScore(
      {
        playerId: "p1",
        displayName: "Alice",
        joinedAtSongIndex: 0,
        correctGuessCount: 3,
      },
      6,
    );
    expect(score.rawScore).toBe(3);
    expect(score.eligibleSongs).toBe(6);
    expect(score.accuracy).toBeCloseTo(0.5);
  });

  it("does not divide by zero for a late joiner with no eligible songs", () => {
    const score = computePlayerScore(
      {
        playerId: "p2",
        displayName: "Bob",
        joinedAtSongIndex: 10,
        correctGuessCount: 0,
      },
      0,
    );
    expect(score.accuracy).toBe(0);
  });
});

describe("rankPlayerScores", () => {
  it("ranks a late joiner with perfect accuracy above an early joiner with more raw correct but lower accuracy", () => {
    const earlyJoiner = computePlayerScore(
      {
        playerId: "early",
        displayName: "Early",
        joinedAtSongIndex: 0,
        correctGuessCount: 4,
      },
      10,
    );
    const lateJoiner = computePlayerScore(
      {
        playerId: "late",
        displayName: "Late",
        joinedAtSongIndex: 8,
        correctGuessCount: 2,
      },
      2,
    );

    const ranked = rankPlayerScores([earlyJoiner, lateJoiner]);
    expect(ranked[0].playerId).toBe("late");
    expect(ranked[1].playerId).toBe("early");
  });

  it("breaks accuracy ties by raw score", () => {
    const a = computePlayerScore(
      { playerId: "a", displayName: "A", joinedAtSongIndex: 0, correctGuessCount: 1 },
      2,
    );
    const b = computePlayerScore(
      { playerId: "b", displayName: "B", joinedAtSongIndex: 0, correctGuessCount: 2 },
      4,
    );
    const ranked = rankPlayerScores([a, b]);
    expect(ranked[0].playerId).toBe("b");
  });
});
