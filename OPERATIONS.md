# sova-x Operations

This file is internal. It documents runtime behavior, operator controls, and production decisions that should not live in the public-facing `README.md`.

## Operating Modes

Primary mode:

- operator-only mention polling on X
- operator includes exactly one mint in the mention text
- bot replies to the operator's trigger tweet

Plan B fallback:

- manual trigger UI
- operator submits trigger tweet URL and mint directly
- same analysis/render/post pipeline

## Core Decision

The current operating decision is:

- primary mode remains mention polling
- manual mode must stay production-ready so polling can be disabled at any time

## Mention Polling Constraints

- X mentions cannot be filtered server-side to allowed operators only
- the service reads all mentions returned by the timeline endpoint
- filtering to allowed operators happens locally after the read
- returned mentions may still count toward X usage before local filtering

## Safety Rules

- only configured `X_ALLOWED_CALLER_IDS` may trigger analysis and reply posting
- unauthorized mentions must be ignored before any Intel call
- self-mentions should be ignored unless explicitly allowed
- parent-tweet reads should remain disabled unless there is a proven need

## Spend Controls

- configure a hard monthly spend cap in the X Developer Console
- treat random mentions as bounded marketing/impression cost
- track:
  - mentions read
  - mentions ignored
  - valid operator triggers
  - replies posted

## Reply Target Rule

- reply to the operator's trigger tweet
- do not assume arbitrary target tweets will accept replies from the bot account
- reply restrictions on X must be treated as normal operational failures, not exceptional design bugs

## Manual Mode Deployment Target

Manual mode should be mountable behind existing dashboard auth when needed.

Production expectations for manual mode:

- restricted to trusted internal users
- preview before post
- persisted run history
- retry failed runs
- text-only fallback if media upload fails

## Required Runtime Controls

- kill switch for polling
- preview-only mode
- dry-run mode for mention classification without replying
- persistent `last_seen_mention_id`
- persistent trigger state and failure reasons

## PM2 Runtime

The mention worker is intended to run as a single PM2 forked process using the checked-in [ecosystem.config.cjs](./ecosystem.config.cjs).

Recommended production shape:

- build first with `npm run build`
- run one instance only to avoid duplicate polling and file-store contention
- keep `SOVA_X_OUTPUT_DIR` on persistent disk because it stores `last_seen_mention_id`, mention history, dedupe state, and metrics
- let PM2 restart the process, but preserve the same working directory and output directory across restarts
- review `out/logs/mention-worker.out.log` and `out/logs/mention-worker.err.log` for structured event logs and failures

PM2 does not rotate `out/logs/mention-worker.out.log` or `out/logs/mention-worker.err.log` by itself in this repo config. Production should enable the PM2 log rotation module on the server:

- `pm2 install pm2-logrotate`
- `pm2 set pm2-logrotate:max_size 10M`
- `pm2 set pm2-logrotate:retain 14`
- `pm2 set pm2-logrotate:compress true`
- `pm2 set pm2-logrotate:rotateInterval '0 0 * * *'`

## Important Files

- [SPEC.md](./SPEC.md) - detailed system/product contract
- [NEXT-STEPS.md](./NEXT-STEPS.md) - implementation backlog
