# Sova X Next Steps

This file is the implementation backlog for `sova-x` only.

It intentionally excludes concerns that belong to the main analyzer backend, such as token metadata caching or holder-profile result caching.

## Decision Snapshot

- Primary mode: operator-only mention polling on X
- Fallback mode: manual trigger UI
- Reply target: the operator's trigger tweet
- Mint source in primary mode: explicit mint inside the mention text
- Mint source in fallback mode: explicit form input
- Cost rule: all returned mentions may count toward X usage before local filtering
- Safety rule: only configured allowed operator X user IDs may trigger replies
- Spend control: enforce a hard monthly spend cap in X Developer Console

## Vector 1: Manual Trigger Production Readiness

- Done: mount the existing manual trigger flow as a reusable server route instead of only a localhost-only inline page.
- Done: restrict manual mode to trusted internal users only via forwarded dashboard auth headers and explicit allowlists.
- Done: persist manual trigger runs, statuses, reply tweet IDs, errors, and timestamps in the file-backed manual run store.
- Done: add a basic run history view for manual mode.
- Done: keep preview-first behavior and require explicit confirmation before posting.
- Done: keep duplicate protection on `target_tweet_id + mint`.
- Done: add retry for failed manual runs.
- Done: add text-only fallback if media upload fails but plain reply posting is still possible.
- Improve operator-facing errors for:
  - analyzer unavailable
  - X auth failure
  - reply restriction on the target conversation
  - invalid tweet URL
  - invalid mint
- Done: make manual mode deployable as a server route with no localhost-only assumptions.

## Vector 2: Mention Polling Production Path

- Done: replace the current mention test script with a real polling worker/service.
- Done: persist `last_seen_mention_id` durably.
- Done: poll `GET /2/users/:id/mentions` using `since_id`.
- Done: keep author expansions and username fields in the mentions request.
- Done: filter returned mentions locally to `X_ALLOWED_CALLER_IDS`.
- Done: ignore self-mentions unless they are intentionally allowed.
- Done: parse exactly one mint from mention text.
- Done: reply to the trigger tweet itself.
- Done: persist processed mention state.
- Persist ignored reasons:
  - Done: unauthorized author
  - Done: invalid mint
  - Done: duplicate
  - Done: self-mention
- Done: persist failure reasons for reply or analysis failures.
- Done: add safe retry/backoff for transient X or analyzer failures.
- Add a hard kill switch to stop polling without code changes.
- Add a dry-run mode that reads and classifies mentions without replying.

## Vector 3: Shared Bot Pipeline

- Done: keep one shared pipeline for:
  - trigger validation
  - mint validation
  - Intel call
  - metadata fetch
  - summary text generation
  - image render
  - reply post
- Done: keep one shared posting service for reply creation and media upload.
- Keep one shared persistence model for:
  - trigger mode
  - trigger tweet ID
  - mint
  - status
  - posted reply ID
  - error details
- Done: keep one shared dedupe/idempotency layer.
- Add structured logs with:
  - Done: run ID
  - Done: mode
  - Done: mint
  - Done: trigger tweet ID
  - Done: reply tweet ID

## Vector 4: Cost And Safety Controls

- Done: expose counts for:
  - mentions read
  - mentions ignored
  - valid operator triggers
  - replies posted
- Add a visible config note or admin surface documenting the X spend cap requirement.
- Done: stop work before the Intel call for unauthorized mentions.
- Keep parent-tweet reads disabled unless a real product need appears.
- Add alerting/logging when mention volume jumps unexpectedly.

## Vector 5: Operational Protections

- Done: add a global disable flag for posting.
- Done: add a preview-only mode for production safety.
- Add replay tooling for:
  - one mention trigger
  - one manual trigger run
- Capture and persist X API error bodies for debugging.
- Done: handle reply-restricted conversations gracefully and mark them failed without infinite retry.

## Recommended Implementation Order

1. Productionize manual mode behind dashboard auth.
2. Add persistence, run history, retries, and posting fallbacks.
3. Extract the shared trigger/render/post pipeline cleanly.
4. Implement the real mention polling worker with durable `since_id`.
5. Add kill switch, preview-only mode, and dry-run mode.
6. Add usage counters and operational logging.

## Progress Notes

- 2026-03-17: Step 1 completed in `sova-x` with a reusable auth-gated manual route, configurable host/base path, and enforced preview-confirm posting.
- 2026-03-17: Step 2 completed for manual mode with durable run persistence, duplicate checks, basic run history, failed-run retry, and text-only post fallback.
- 2026-03-17: Step 3 partially completed with shared reply-content generation and a shared reply-posting service reused by both manual and mention flows.
- 2026-03-17: Step 4 started with a real polling worker, durable `last_seen_mention_id`, persisted mention outcomes, and shared target-tweet-plus-mint dedupe across manual and mention flows.
- 2026-03-17: Step 5 started with env-driven posting disable, preview-only mode, and mention dry-run mode wired into the live worker and manual posting path.
- 2026-03-17: Step 6 started with file-backed counters and structured event logging across manual and mention flows.
- 2026-03-17: Mention failure handling was hardened with bounded retry/backoff, persisted retry metadata, and terminal classification for reply-restricted/auth/permanent failures.

## Explicit Non-Goals For This Backlog

Do not expand this file with tasks that belong to the main analyzer backend, including:

- token metadata caching
- holder-profile result caching
- core analyzer performance work unrelated to `sova-x`
- generic dashboard refactors unrelated to mounting the bot UI
