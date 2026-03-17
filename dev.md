# sova-x

**Turn token intelligence into native X replies.**

`sova-x` is the X-facing delivery layer for Sova Intel. It takes a token trigger, pulls holder-profile analysis from the Sova Intel SDK, distills the result into a compact social summary, renders a deterministic card image, and publishes a reply directly into an X thread.

The analyzer stays outside this repo. `sova-x` is responsible for trigger handling, reply composition, media rendering, and X transport.

## Why This Exists

Token analysis is most useful when it appears where attention already is. `sova-x` is built to turn a dashboard-grade holder-profile result into a thread-native X reply that is readable, visual, and fast to consume.

The service is designed around one narrow job:

- take a mint
- fetch holder intelligence
- compress it into a high-signal reply
- publish it in-thread

## What It Produces

Each successful run produces:

- a short reply text for X
- a deterministic PNG social card
- one in-thread reply under the chosen conversation

The current output is intentionally narrow:

- supply-weighted holder behavior distribution
- fresh-wallet share
- clean token presentation

It does not attempt to mirror the full dashboard or dump raw holder rows into a social reply.

## Architecture

At a high level, `sova-x` does four things:

1. Accept a trigger from an approved source
2. Fetch holder-profile data through `@sova-intel/sdk`
3. Build summary text and render a social card
4. Post the reply on X

Core boundaries in this repo:

- `src/intel/` - Sova Intel SDK client wrapper
- `src/metadata/` - token presentation metadata lookup
- `src/core/` - parsing, summary derivation, and trigger helpers
- `src/render/` - SVG and PNG card generation
- `src/x/` - X auth, posting, mentions, and media upload
- `src/app/` - trigger processing pipeline
- `src/scripts/` - local verification and workflow scripts

## Current Capabilities

- live holder-profile fetches through the Sova Intel SDK
- deterministic SVG-to-PNG social card rendering
- manual X auth verification for OAuth 1.0a and OAuth 2.0
- text posting and media posting on X
- trigger processing for both mention-driven and manual flows

## Development Scripts

### Build and Verification

- `build` - compile TypeScript to `dist/`
- `verify` - type-check the project

### Rendering

- `test:render` - render fixture-based output locally
- `test:live-render <mint>` - fetch live holder profiles and render real output

### X Authentication

- `test:x:oauth1-me` - verify OAuth 1.0a user-context auth
- `test:x:oauth2-start` - start OAuth 2.0 PKCE flow
- `test:x:oauth2-listen` - receive OAuth 2.0 callback locally
- `test:x:oauth2-complete "<callback_url>"` - finish OAuth 2.0 token exchange manually
- `test:x:oauth2-me` - verify OAuth 2.0 user-context auth

### X Posting

- `test:x:post` - create a simple text post
- `test:x:media-post [pngPath] [replyToTweetId] [text...]` - create a post or reply with attached media

### Trigger Workflow

- `test:x:mentions` - inspect mention retrieval behavior
- `manual:server` - run the local manual trigger UI for preview/post flow

## Quick Start

### 1. Install and configure

Create `.env` from `.env.example` and provide:

- Sova Intel base URL and API key
- X auth credentials for the posting path you intend to use

### 2. Build

```powershell
pwd
npx tsc -p tsconfig.json
```

### 3. Verify rendering

```powershell
pwd
node dist\scripts\test-render.js
```

### 4. Verify X auth

```powershell
pwd
node dist\scripts\test-x-oauth1-me.js
```

### 5. Verify posting

```powershell
pwd
node dist\scripts\test-x-post.js "sova-x post test"
```

## Local Manual Flow

For local operator testing, the repo includes a small manual trigger server:

```powershell
pwd
node dist\scripts\manual-trigger-server.js
```

It exposes a local page for:

- entering a trigger tweet URL
- entering a mint
- previewing the reply text and generated image
- posting the reply

This is useful for verifying the end-to-end render/post pipeline without running the full primary trigger mode.

## Design Principles

- **Transport only:** this repo does not own analyzer logic
- **Deterministic output:** social cards are rendered from structured data, not screenshots
- **Tight reply format:** replies should be compact, visual, and legible at a glance
- **Replaceable triggering:** trigger mode can evolve without rewriting the render/post pipeline
- **Minimal X surface area:** keep the X integration explicit and debuggable

## Documentation

- [SPEC.md](./SPEC.md) - product and system contract
- [OPERATIONS.md](./OPERATIONS.md) - internal runtime and operational notes
- [NEXT-STEPS.md](./NEXT-STEPS.md) - implementation backlog

## Status

This repo is already useful for:

- validating X auth
- rendering production-style output
- testing real token replies locally
- exercising the current posting path end-to-end

It is not yet fully productionized as a continuously running service. The current roadmap and operating decisions live in [NEXT-STEPS.md](./NEXT-STEPS.md) and [OPERATIONS.md](./OPERATIONS.md).
