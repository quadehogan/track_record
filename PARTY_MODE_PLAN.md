# Party mode — implementation tracker

Working doc for building "Party" as a second game format alongside the
existing "Road Trip" format. Update checkboxes as work lands; keep the
"Key decisions" section authoritative if anything below drifts from it.

## Key decisions (confirmed with Quade)

- **Two formats only, chosen at creation**: Road Trip or Party. The old
  independent "guessing mode" (all at once / drip) and "reveal mode"
  (immediate / end of song / end of game) choices go away from the UI.
- **Road Trip** = today's existing flow, unchanged under the hood:
  `guessingMode: all_at_once`, `revealMode: end_of_game`, hardcoded at
  creation instead of chosen. No changes to its code path.
- **Party** = new, round-based lifecycle:
  - Host picks a fixed number of rounds at creation.
  - Each round has one prompt (e.g. "when your best friend tells you good
    news"), either custom-written or chosen from a premade list of 50.
  - The prompt-setter role **rotates** to a different player each round,
    in join order.
  - Per round: prompt set → everyone else submits one song matching it →
    guess who submitted each (same drag-and-drop board, scoped to that
    round's songs) → reveal → next round.
  - Game auto-finishes after the last round's reveal, into the existing
    results/leaderboard screen.
- Late-joiner eligibility for Party is tracked **by round index**
  (parallel to how Road Trip tracks it by song index) — a new field,
  not a rework of the existing one.

## Already shipped (this session, prior to Party mode work)

- [x] Drag-and-drop guess board (buckets per player, one staged song at a
      time, reorganize before reveal/close) — committed & pushed.
- [x] Editable guesses (upsert) until revealed — committed & pushed.
- [x] Results screen restyled to match the bucket-grid layout — committed
      & pushed.
- [x] Reveal-pop animation, host per-player guess-progress chips,
      "perfect read" badges, emoji reactions on revealed songs (new
      `song_reactions` table, migration applied to prod DB) — **built and
      browser-verified, not yet committed/pushed.**

## Chunk 1 — Schema & core round model ✅ done

- [x] `games.format` enum: `road_trip` | `party`
- [x] `games.totalRounds` (nullable; set for Party only)
- [x] `rounds` table: `id`, `gameId`, `roundIndex`, `prompt`,
      `promptSetterPlayerId`, `status` (`awaiting_prompt` | `submitting`
      | `guessing` | `revealed`)
- [x] `songs.roundId` (nullable FK; null for Road Trip songs)
- [x] `players.joinedAtRoundIndex` (defaults to 0; Party's parallel to
      `joinedAtSongIndex`)
- [x] Migration generated (`db:generate`) and applied (`db:migrate`) —
      `drizzle/0004_redundant_beyonder.sql`, additive only
- [x] `lib/game-state.ts`: `getPromptSetterForRound` (rotation),
      `isRoundEligibleForPlayer` (round-based eligibility). Round *status*
      transitions turned out to be data-dependent (needs DB reads to know
      when everyone's submitted/guessed) so those live in the Chunk 2/3 API
      routes instead of as pure helpers here.
- [x] `lib/prompts.ts`: 50 premade prompts
- [x] `npx tsc --noEmit` and `next build` both clean

## Chunk 2 — Party creation, prompt-setting, submission ✅ done

- [x] Simplify `/game/create`: single Road Trip vs Party radio, removed
      the old guessing-mode/reveal-mode radios entirely
- [x] Party creation: round-count picker (1-20, default 5)
- [x] `POST /api/games` branches on format: Party creates round 1
      (`roundIndex: 0`) and assigns the host as first prompt-setter
- [x] New "set the prompt" screen for whoever's turn it is — custom text
      input plus a "🎲 Random prompt" button that fills from the 50-prompt
      bank (still editable before submitting)
- [x] New API route `POST /api/games/[code]/rounds/prompt`
- [x] Submission screen shows the active round's prompt; submission is
      capped at one song per player per round (409 on a second attempt),
      scoped to `songs.roundId`
- [x] `game-view.ts` now exposes `game.format` and a `round` object
      (index, total, prompt, status, whose turn, isMyTurn); `mySubmittedSongs`
      / `submittedCount` are round-scoped for Party
- [x] Host sees a placeholder ("Round transitions are coming in the next
      update") instead of a working close-submissions button for Party —
      intentional, that's Chunk 3
- [x] Verified end-to-end in the browser: Road Trip creation/flow
      unaffected; Party round 1 prompt-setting (host), random-prompt fill,
      song submission, cross-player round-scoping via a second joined
      player, duplicate-submission rejection (409), and remove-then-resubmit
      all confirmed working
- [x] `npx tsc --noEmit` and `next build` both clean

## Chunk 3 — Party guessing, reveal, round advancement ✅ done

- [x] `game-view.ts`: songs scoped to the current round while a Party
      round is being guessed; all rounds' songs once the game is finished
- [x] Guess board works unchanged against round-scoped songs (no
      component changes needed — it just receives a smaller `songs` list)
- [x] Round reveal happens automatically once every eligible player has
      guessed that round (fixed a bug from chunk 2: Party games were
      created with `revealMode: end_of_game`, which would've silently
      withheld every answer until the whole game ended — corrected to
      `end_of_song`, which reveals per-round as designed)
- [x] Eligibility is now round-aware end to end: added
      `getEligiblePlayerIds` (lib/game-state.ts) so Road Trip's
      song-index eligibility and Party's round-index eligibility share
      one code path instead of duplicating the "who's eligible to guess
      this" logic per call site (game-view.ts, the guess route, and the
      per-player progress chips all use it now). `join` now also stamps
      `joinedAtRoundIndex` for late joiners.
- [x] `close-submissions` and `finish` both branch on `game.format`:
      Party scopes the shuffle/unlock to the current round only, and
      `finish` now doubles as "end this round" — it closes the round's
      songs (forcing reveal for stragglers), and either rotates to the
      next round (new prompt-setter via `getPromptSetterForRound`, back
      to `awaiting_prompt`) or marks the game finished if it was the
      last round
      - Note: Round-count-based "last round" is the only way a Party
        game auto-finishes right now (matches the confirmed decision:
        host sets the round count upfront)
- [x] `guessing-view.tsx`: round header + prompt shown above the guess
      board; the button now reads "End round & continue" mid-game vs
      "End game & show results" on the last round (same endpoint)
- [x] Verified end-to-end in the browser: full 2-round Party game,
      prompt-setter rotation (host → Sam) confirmed correct, automatic
      per-round reveal on last guess confirmed, round-scoped guess board
      confirmed (no cross-round song leakage), final leaderboard/results
      screen aggregates correctly across both rounds using the *existing*
      results/leaderboard code unchanged (4/4 and 2/4 scores matched
      exactly what was guessed)
- [x] `npx tsc --noEmit` and `next build` both clean

**Known, deliberately deferred to chunk 4**: `lib/scoring.ts`'s
`countEligibleSongs` still uses song-index eligibility for the results
leaderboard's denominator, which is only correct for Party when nobody
joins mid-game (every song's index passes trivially). A late joiner's
"eligible songs" count will be wrong until chunk 4 makes it round-aware
too. Not a crash risk, just an inaccurate number for that one scenario.

## Chunk 4 — Results integration, polish, verification

- [ ] Confirm leaderboard/scoring is correct across multiple rounds
      (round-based eligibility feeding the existing scoring code)
- [ ] Full end-to-end browser test of a real multi-round Party game
- [ ] Commit and push
