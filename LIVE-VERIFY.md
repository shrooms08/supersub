# LIVE-VERIFY: genuinely live fixture verification runs

Each paragraph below is appended by scripts/live-verify.mjs at the end
of an unattended run (usage in the script header; full line-by-line
evidence in LIVE-VERIFY.log, raw payloads in samples/). The first two
entries are the harness shakedown against the finished Spain v Belgium
fixture (18218149): they prove the machinery (both reconstruction
planes agreeing, zero parse failures) and are expected to read NOT
CONCLUSIVE because a finished match has no live traffic to listen to.

## Live verification, 2026-07-11T11:44:09.692Z

Fixture 18218149 against https://supersub-tau.vercel.app, live mode, 1 minute listen window. Mid-match join via the production stream reconstructed 2-1 at minute 0' (phase finished), and the raw snapshot-plus-sealed-interval path rebuilt 2-1 from 1080 events, agreeing with the app plane. Received 0 events and 0 odds ticks on the production stream, plus 0 events and 0 odds ticks on the raw feed, every payload run through the normalization layer with 0 parse failures. Live top-level field shapes introduced new keys: scores ["Competition","Participant1","Participant2"], odds []. The run was read-only against production (GET /api/fixtures and GET /api/stream only); the join path needs no identity, so no throwaway player was created and no entries were written. Verdict: NOT CONCLUSIVE, see LIVE-VERIFY.log. Raw evidence: samples/live-18218149.ndjson.

## Live verification, 2026-07-11T11:48:59.099Z

Fixture 18218149 against https://supersub-tau.vercel.app, live mode, 0.2 minute listen window. Mid-match join via the production stream reconstructed nothing (no backfill received), and the raw snapshot-plus-sealed-interval path rebuilt 2-1 from 1080 events, agreeing with the app plane. Received 0 events and 0 odds ticks on the production stream, plus 0 events and 0 odds ticks on the raw feed, every payload run through the normalization layer with 0 parse failures. Live top-level field shapes matched the spike's historical samples exactly. The run was read-only against production (GET /api/fixtures and GET /api/stream only); the join path needs no identity, so no throwaway player was created and no entries were written. Verdict: NOT CONCLUSIVE, see LIVE-VERIFY.log. Raw evidence: samples/live-18218149.ndjson.
