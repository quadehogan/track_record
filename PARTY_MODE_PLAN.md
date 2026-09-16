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

## Chunk 3 — Party guessing, reveal, round advancement

- [ ] `game-view.ts`: scope songs/guessing to the current round for
      Party games
- [ ] Guess board works against round-scoped songs (reuse existing
      drag-and-drop component, just filtered)
- [ ] Round reveal once all eligible players have guessed that round
- [ ] "Next round" transition: rotate prompt-setter, create next round,
      back to the prompt-setting screen
- [ ] Auto-finish game after the final round's reveal

## Chunk 4 — Results integration, polish, verification

- [ ] Confirm leaderboard/scoring is correct across multiple rounds
      (round-based eligibility feeding the existing scoring code)
- [ ] Full end-to-end browser test of a real multi-round Party game
- [ ] Commit and push
