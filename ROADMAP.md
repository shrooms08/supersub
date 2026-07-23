# Roadmap

Super Sub shipped in three weeks for the Superteam x TxODDS World Cup
hackathon, built solo. Plenty was deliberately left out. This document is
the record of what comes next and, more importantly, **why each item was
not in the hackathon build**. Most were cut for a reason, not for time.

Items are grouped by what they unlock. Within each group they are roughly
ordered by value.

---

## 1. Depth for the live product

### Full tournament history
**What:** the RESULTS tab currently shows the 12 most recent finished
fixtures. It should carry every match of a tournament, grouped by matchday
with day headers.

**Why not yet:** every historical fixture requires folding its event log to
produce a timeline, and a naive implementation sweeps thousands of five
minute intervals per fixture. The Match Detail feature solved this with a
per fixture computed cache, so the machinery now exists; what remains is
pagination and grouping. Deferred because a judge reads a results list for three seconds, and 12 rows told the truth.

### Bracket view
**What:** a knockout tree showing the path through the tournament, who
advanced, and where a fixture sits in the structure.

**Why not yet:** the feed provides fixtures and results, not bracket
structure, so progression has to be derived. It is also a genuinely new
view with its own mobile layout problem rather than an extension of an
existing screen. Highest visual payoff of anything in this section, and
worth building against the *next* tournament rather than a finished one.

### Match detail on every fixture
**What:** Match Detail exists for finished and in play fixtures where the
historical endpoints can supply a log. Coverage is not universal.

**Why not yet:** where TxLINE coverage opens mid match, goals scored before
coverage exist only in cumulative totals and have no event row. The report
annotates the gap honestly rather than inventing a scorer. Closing this
depends on the feed, not on us.

---

## 2. Scoring and competition design

### Multiplier weighted rating
**What:** Impact Rating is currently a flat average of final scores. A flop
at 10x should cost more rating than a flop at 1.2x, so recklessness carries
a price without producing negative scores.

**Why not yet:** the flat average is defensible and easy to explain, and
changing the shape of the headline number mid tournament would invalidate
every career on the board. This is the more sophisticated version of the
"negative points" idea: it keeps the leaderboard readable while making
courage cost something.

### Minimum appearances to qualify
**What:** a player with one lucky 10x currently outranks a veteran with a
long consistent record, because the rating is an average.

**Why not yet:** with a small player base, a qualification threshold would
have emptied the table. It becomes necessary the moment the population is
large enough for the tradeoff to bite.

### Extra time entries ("Into the Night")
**What:** knockout matches that reach extra time reopen the bench for a
second, separately priced entry.

**Why not:** designed in full and then **cut on evidence**. TxLINE's 1X2
market closes at the regulation whistle and no market of any kind updates
during extra time, verified across a complete AET fixture: 3,151 odds
records, all full match period, zero during the 40 minute extra time
window. Without a live pricing signal, the multiplier would have been
invented rather than market derived, which contradicts the product's
central claim. Ships the day an ET period market exists.

### Exhibition provenance
**What:** replay entries are excluded from Impact Rating, the table and
Legendary Entries, and are tagged EXHIBITION in career history. A richer
version would separate archive and competitive records more visibly across
every surface.

**Why not yet:** the current rule is correct and complete. This is polish
on presentation, not behaviour.

---

## 3. Retention and reach

### Live notifications ("the gaffer says warm up")
**What:** a push the moment a match you are benched for turns volatile (a
red card, a goal, a probability collapse) so you never miss your entry
window.

**Why not yet:** the entire game is being there at the right minute, which
makes this the strongest retention mechanic available. It is also a new
subsystem (permissions, delivery, a trigger engine watching odds volatility
per fixture) and it is close to useless on web, where the tab is closed.
It belongs with the native client below.

### Native Seeker client
**What:** Super Sub as a native app on Solana Mobile's Seeker, shipped to
the dApp Store.

**Why not yet:** the hackathon rewarded a URL a judge could open. But fans
watch football with a phone in hand, notifications only work natively, and
identity is already wallet native. On a device where the wallet *is* the phone, claiming a legend becomes one tap. The backend, scoring engine, data
layer and identity system all carry over unchanged; this is a new client on
proven rails. Grant applied for.

### Year round leagues
**What:** the engine is fixture agnostic. Any competition the data layer
covers can run the same product, every weekend.

**Why not yet:** the hackathon dataset was the World Cup. Extending depends
on commercial data coverage rather than on the product.

---

## 4. On chain

### Minting claimed careers
**What:** claiming currently binds a career to a Solana wallet created from
an email. The next step is minting the career itself, with its
appearances, badges and match reports, as a permanent on chain artifact.

**Why not yet:** binding identity was the load bearing half and it shipped.
Minting is the flex on top, and doing it properly means deciding what a
career artifact *is* (a card, a collection, an evolving token) rather than
rushing a mint to say the word "NFT".

### Mainnet
**What:** the TxLINE subscription runs on devnet, where the free real time
tier lives. Player wallets are real Solana wallets; no value moves on chain
today.

**Why not yet:** paying for mainnet subscription access during a hackathon
would have bought nothing a judge could see. Moves with minting.

---

## 5. Product polish

Small, known, and honestly deferred:

- **Player names on historical data.** Names resolve from a lineups roster
  that exists only in live streams, and only on confirmed action instances.
  Replays without a captured roster show team only rows. We do not invent
  names.
- **Lost window copy.** A zero point career row reads as absence rather
  than as a story. A real user read his own correctly scored zero as a bug,
  which is a communication failure, not a scoring one.
- **Live probability marker.** The current value marker on the win
  probability curve jitters as the chart refits on each tick. Cosmetic.
- **Explicit home and away ordering.** Home team renders left today by
  convention (Participant1 is home on every fixture checked). Making it
  explicit removes a dependency on that convention holding.
- **Friendlies coverage.** The stream flows but a fixture detail lookup
  404s on some friendlies, leaving dependent UI in a loading state rather
  than degrading. Reported upstream.
- **Second half section break** in live match reports; period breaks
  currently mark kickoff, half time, full time, extra time and penalties.

---

## Principles this roadmap keeps

Three rules governed what shipped, and they govern what comes next:

1. **Never invent data.** No guessed scorers, no fabricated odds, no
   invented multipliers. Where the feed is silent, the product says so.
2. **Scores are rebuilt, never accumulated.** Every score is a pure
   function of the verified event log, which is why a VAR overturn can take
   points back and why a bug is never data loss.
3. **The market prices the risk.** The multiplier comes from real consensus
   odds. When no market exists, as in extra time, the feature does not ship
   rather than shipping a number we made up.
