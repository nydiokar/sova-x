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

## Important Files

- [SPEC.md](./SPEC.md) - detailed system/product contract
- [NEXT-STEPS.md](./NEXT-STEPS.md) - implementation backlog
