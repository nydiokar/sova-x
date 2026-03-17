<div align="center">

<img src="https://sova.intel/badge.svg" alt="Sova Intel" width="80" />

# SOVA X

### Real-Time Holder Intelligence, Native on X

**Know who's holding. Know how they trade. Posted directly in your thread.**

[![Powered by Sova Intel](https://img.shields.io/badge/Powered%20by-Sova%20Intel-0b1729?style=for-the-badge&labelColor=07111f&color=8f98f7)](#)
[![Solana](https://img.shields.io/badge/Solana-Native-8fd17c?style=for-the-badge&labelColor=07111f)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-7dc4ec?style=for-the-badge&labelColor=07111f)](#)

---

*Mention @sova_intel under any Solana token discussion on X.*
*Within seconds, a beautiful holder profile card appears — right in the thread.*

</div>

<br/>

## The Problem

Every Solana thread is full of conviction — and full of noise. Someone says a token is "held by diamond hands." Someone else says it's "all snipers." Nobody has data. Everyone is guessing.

**Until now.**

<br/>

## What Sova X Does

Sova X brings **institutional-grade holder profiling** directly into X conversations. No dashboards to open. No links to click. No screenshots to squint at.

An operator mentions `@sova_intel` with a token mint, and the system delivers a **deterministic, data-rich social card** as an in-thread reply — powered by the full analytical depth of Sova Intel's holder profiling engine.

<br/>

<div align="center">

### One mention. One card. Complete clarity.

</div>

<br/>

## What You Get

### Trader Distribution Breakdown

Every card visualizes the **supply-weighted holding patterns** of the top 20 holders, classified by behavioral archetype:

| Archetype | Typical Timeframe |
|---|---|
| **Sniper** | < 10 seconds |
| **Scalper** | < 1 minute |
| **Momentum** | 5 – 30 minutes |
| **Intraday** | 30 min – 4 hours |
| **Day Trader** | 4 – 24 hours |
| **Swing** | 1 – 7 days |
| **Position** | 7+ days |
| **Fresh** | No exit history |

Each bar shows **exactly how much supply** is concentrated in each trader type — not wallet counts, not vibes. Real distribution, weighted by holdings.

### Fresh Supply Detection

Every card surfaces the **fresh wallet percentage** — the share of supply held by wallets with no exit history on the token. A single number that instantly tells you how much of the cap table is untested.

### Token-Aware Presentation

Cards automatically resolve token metadata — symbol, icon, and shortened mint — so every reply looks clean and contextual, not like a raw data dump.

<br/>

## How It Works

<div align="center">

**Mention** → **Profile** → **Render** → **Reply**

</div>

1. A trusted operator mentions `@sova_intel` with a Solana mint address in any X thread
2. Sova X picks up the mention and validates the operator and the mint
3. The Sova Intel SDK runs **deep holder profiling** on the top 20 holders
4. A deterministic **1200×675 PNG social card** is rendered server-side — no headless browsers, no screenshots
5. The card is posted as an **in-thread reply** under the original conversation

The entire pipeline — from mention to posted reply — is automated, auditable, and built for speed.

<br/>

## Native X Mentions

The flagship experience. Operators mention `@sova_intel` directly in live X threads. The bot polls its mentions timeline, filters to authorized operators, extracts the mint, and delivers the card in-thread.

**This is holder intelligence that lives where the conversation already is.**

<br/>

## Built for Trust

- **Operator-only access** — only explicitly authorized X accounts can trigger analysis
- **Strict mint parsing** — no guessing, no inference, no ambiguity. One valid Solana address or nothing
- **Deduplication** — the same tweet + mint combination won't produce duplicate replies
- **Silent failure** — if something goes wrong, the bot stays quiet. No public error messages, ever
- **Deterministic rendering** — identical data always produces an identical card. No flicker, no variance

<br/>

## Architecture

Sova X is a **standalone service** that treats Sova Intel purely as an intelligence layer via its public SDK. It owns no analytical logic. It copies no internal code. It is a clean, single-purpose delivery surface.

```
sova-x
├── app/          → Mention processing & trigger pipeline
├── core/         → Distribution computation, summary generation
├── intel/        → Sova Intel SDK integration
├── metadata/     → Token symbol, icon & mint resolution
├── render/       → Deterministic SVG → PNG social card generation
├── x/            → Full X API client (OAuth 1.0a + OAuth 2.0 PKCE)
└── config/       → Environment & credential management
```

<br/>

## The Sova Intel Ecosystem

Sova X is one surface of the **Sova Intel** analytical platform — purpose-built for Solana token holder intelligence.

| Surface | Purpose |
|---|---|
| **[Sova Intel API](https://docs.sova-intel.com/)** | The analytical engine — holder profiling, behavioral classification, supply analysis |
| **Sova Intel SDK** | Programmatic access to the full intelligence layer |
| **Sova Intel Dashboard** | Interactive visual exploration of holder profiles |
| **Sova X** | Real-time holder intelligence delivered natively on X |

Every surface shares the same analytical foundation. Same data. Same methodology. Same depth.

### For AI Agents

Sova Intel exposes a **machine-readable skill definition** at [`sova-intel.com/skill.md`](https://sova-intel.com/skill.md) — purpose-built for AI agents and autonomous workflows. Any agent that can read a skill file can integrate Sova Intel's holder profiling capabilities directly, no custom integration work required.

### API Documentation

Full API reference, authentication guides, and integration examples are available at **[docs.sova-intel.com](https://docs.sova-intel.com/)**.

<br/>

<div align="center">

---

<br/>

**Sova X** — Holder intelligence that meets the conversation where it happens.

<br/>

*Built by the Sova Intel team.*

</div>
