# Verification trail

Every phase of Super Sub was gated with captured evidence before merge:
smoke runs over the real pipeline, screenshots at both widths, security
audits, a scoring audit against real match data, and a verification run
against a genuinely live World Cup fixture. This folder holds those
records, in order.

## Phase gates

- [SMOKE.md](SMOKE.md) - Phase 1 definition of done: the event-sourced fold against the real France v Morocco log, the full replay loop over HTTP (enter, VAR, resolve, persist), live mode on the same build.
- [SMOKE2.md](SMOKE2.md) - Phase 2: signed player identity, the career page and aggregates, the Gazette match report with template fallback, and the badge cabinet.
- [SMOKE3.md](SMOKE3.md) - Phase 3: production deploy on Vercel, the demo kit and submission documents, and a full-history secrets audit of the repo.
- [SMOKE4.md](SMOKE4.md) - Phase 4: the matchday-broadcast design pass (atmosphere, typographic scale, microcopy).
- [SMOKE5.md](SMOKE5.md) - Canonical design alignment, phase 1: the bench and match screens brought to the binding design reference.
- [SMOKE6.md](SMOKE6.md) - Canonical design alignment, phase 2: Signing Day and the twelve-position vocabulary.
- [SMOKE7.md](SMOKE7.md) - Visual alignment to the binding reference: side-by-side reference-vs-implementation captures of all five screens at both widths.
- [SMOKE8.md](SMOKE8.md) - RLS security lockdown: anon can no longer delete or cross-write; deletion moves to a service-role admin path.
- [SMOKE9.md](SMOKE9.md) - The fold-bug audit that corrected Argentina v Egypt from 3-1 to 3-2 (a VAR-discarded goal was double-subtracted), with regression tests and the stored-entry recompute.

## Features

- [SMOKE11.md](SMOKE11.md) - The Fixtures: the real World Cup schedule on the bench (today, coming up, results with canonical scores), plus the server-side playability guards and LiveScore-style tabs.
- [SMOKE12.md](SMOKE12.md) - Claim Your Legend: Privy email sign-in binding a career to a wallet, resume-on-any-browser, and the wallet page.
- [SMOKE-DETAIL.md](SMOKE-DETAIL.md) - Match Detail: the full broadcast timeline of a finished match, cached per fixture, with the VAR-overturned Egypt goal struck through as event-sourcing proof.
- [SMOKE-BRAND.md](SMOKE-BRAND.md) - Brand asset pass: favicon, app icons, social cards, and the masthead mark, with a no-layout-shift check.
- [SMOKE-EXHIBITION.md](SMOKE-EXHIBITION.md) - Exhibition replays: entries on the bundled replay fixtures keep the full loop and career history but never touch a competitive number.
- [SMOKE-FINAL.md](SMOKE-FINAL.md) - Flags in the match scoreboard and resolved player names in the live ticker.
- [SMOKE-DISPLAY.md](SMOKE-DISPLAY.md) - Rendering scored penalties in the match report and a pre-coverage marker for goals that predate the feed's coverage.
- [SMOKE-HISTORY.md](SMOKE-HISTORY.md) - Full tournament history: the RESULTS tab carries every finished fixture grouped by UTC day, newest first, with a day-list cache plus per-fixture canonical-score cache and day pagination (cold and warm timings measured).
- [SMOKE-WORLDCUP.md](SMOKE-WORLDCUP.md) - World Cup only: Friendlies (competition 430) filtered out of the bench, results history, and every match path at the fixture source; a direct friendly URL degrades gracefully (results count 152 to 106).
- [SMOKE-BRACKET.md](SMOKE-BRACKET.md) - Knockout bracket: the tournament tree (Round of 32 to Final plus the champion) with stage names inferred from fixture counts, a deliberate vertical-rounds layout at 390px and the full horizontal tree on desktop, group letters honestly omitted because the feed does not expose them.
- [SMOKE-BRACKET-CARDS.md](SMOKE-BRACKET-CARDS.md) - Bracket card sizing: cards widened and heightened (measured against the longest real name, "Bosnia & Herzegovina") so names no longer truncate, the pens line never wraps, and footers clear the border; tree coordinates and connector geometry recomputed from the new card size.
- [SMOKE-BRACKET-V2.md](SMOKE-BRACKET-V2.md) - Bracket redesign: a mirrored tournament tree, two halves converging on a centred Final, with the halves threaded deterministically backward from the Final by team identity, SVG connector elbows, the champion's road in volt, and the mobile stacked-rounds fallback.

## Live and production checks

- [LIVE-VERIFY.md](LIVE-VERIFY.md) - PASS against a genuinely live World Cup fixture (Norway v England): 95 events reconstructed through the normalization layer with zero parse failures, shapes matching the historical samples.
- [LIVE-VERIFY.log](LIVE-VERIFY.log) - The raw line-by-line log of the unattended live-verify runs.
- [SMOKE-LIVE.md](SMOKE-LIVE.md) - Live fixture polish: live bench cards (minute and score from one shared poll), the match report on in-play fixtures, and the ticker link.
- [SMOKE-RESOLVE.md](SMOKE-RESOLVE.md) - The production resolution bug and fix: live-fixture entries now resolve server-side from the event-sourced log regardless of whether anyone is watching at full time.
- [SMOKE13.md](SMOKE13.md) - The full player-data wipe run before launch, with the dry run, post-wipe state, and a fresh-signing proof.
