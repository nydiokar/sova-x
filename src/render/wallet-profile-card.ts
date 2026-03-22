import { SOVA_BADGE_SVG } from '../assets/sova-badge';
import type { WalletProfileResponse } from '@sova-intel/sdk';

// ── Behavior metadata keyed on hud.behaviorCode (from public API) ────────────

const STYLE_META: Record<string, { label: string; color: string }> = {
  // Full string codes
  SNIPER:          { label: 'Sniper',          color: '#ff6b7a' },
  SCALPER:         { label: 'Scalper',         color: '#ff9f5a' },
  MOMENTUM:        { label: 'Momentum',        color: '#f5d86a' },
  INTRADAY:        { label: 'Intraday',        color: '#5ee8d8' },
  DAY_TRADER:      { label: 'Day Trader',      color: '#5bbff5' },
  SWING_TRADER:    { label: 'Swing Trader',    color: '#8f98f7' },
  POSITION_TRADER: { label: 'Position Trader', color: '#b07ef5' },
  HODLER:          { label: 'Hodler',          color: '#6ee87a' },
  HOLDER:          { label: 'Hodler',          color: '#6ee87a' },
  SWING:           { label: 'Swing Trader',    color: '#8f98f7' },
  POSITION:        { label: 'Position Trader', color: '#b07ef5' },
  // Single-letter abbreviations (as returned by some API responses)
  S:               { label: 'Sniper',          color: '#ff6b7a' },
  SC:              { label: 'Scalper',         color: '#ff9f5a' },
  M:               { label: 'Momentum',        color: '#f5d86a' },
  I:               { label: 'Intraday',        color: '#5ee8d8' },
  D:               { label: 'Day Trader',      color: '#5bbff5' },
  SW:              { label: 'Swing Trader',    color: '#8f98f7' },
  P:               { label: 'Position Trader', color: '#b07ef5' },
  H:               { label: 'Hodler',          color: '#6ee87a' },
};

const TIER_META: Record<string, { color: string; bg: string; border: string }> = {
  GOLD:         { color: '#f5d86a', bg: 'rgba(245,216,106,0.13)', border: 'rgba(245,216,106,0.55)' },
  SILVER:       { color: '#c0cfe0', bg: 'rgba(192,207,224,0.10)', border: 'rgba(192,207,224,0.45)' },
  BRONZE:       { color: '#d48c50', bg: 'rgba(212,140,80,0.13)',  border: 'rgba(212,140,80,0.55)'  },
  INSUFFICIENT: { color: '#4a6080', bg: 'rgba(74,96,128,0.10)',   border: 'rgba(74,96,128,0.4)'    },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shortenAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function formatHoldTime(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—';
  if (hours < 1 / 60) return `${Math.round(hours * 3600)}s`;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  if (days < 7) return `${days.toFixed(1)}d`;
  return `${(days / 7).toFixed(1)}w`;
}

function formatPnl(sol: number | null): { text: string; color: string } {
  if (sol === null || !Number.isFinite(sol)) return { text: '—', color: '#2e4a6a' };
  const sign = sol >= 0 ? '+' : '';
  return {
    text: `${sign}${sol.toFixed(2)} SOL`,
    color: sol >= 0 ? '#6ee87a' : '#ff6b7a',
  };
}

function formatWinRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  return `${Math.round(rate * 100)}%`;
}

function formatExitPattern(p: string | null): string {
  if (!p) return '—';
  // Title-case whatever the API sends (handles "ALL AT ONCE", "partial_exit", etc.)
  return p
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveStyle(behaviorCode: string | null): { label: string; color: string } {
  if (!behaviorCode) return { label: '—', color: '#8ea4c4' };
  return STYLE_META[behaviorCode] ?? { label: behaviorCode.replace(/_/g, ' '), color: '#8ea4c4' };
}

// ── Main renderer ────────────────────────────────────────────────────────────

export function renderWalletProfileCardSvg(data: WalletProfileResponse): string {
  const W = 1200;
  const H = 675;
  const pad = 60;

  const hud = data.hud;
  const behavior = data.behavior;

  // Resolve trading style from behaviorCode
  const style = resolveStyle(hud?.behaviorCode ?? null);
  const accent = style.color;

  // Resolve tier
  const tier = hud?.dataQualityTier ?? 'INSUFFICIENT';
  const tierM = TIER_META[tier] ?? TIER_META.INSUFFICIENT;

  // Hold time: prefer behavior.medianHoldTimeHours, fall back to hud
  const holdHours = behavior?.medianHoldTimeHours ?? hud?.medianHoldTimeHours ?? null;

  // PnL: prefer pnl.allTime.realizedPnlSol, fall back to summary.realizedPnl
  const realizedSol = data.pnl?.allTime?.realizedPnlSol ?? data.summary?.realizedPnl ?? null;
  const pnl = formatPnl(realizedSol);

  const winRate = formatWinRate(hud?.winRate ?? null);
  const hold = formatHoldTime(holdHours);
  const exit = formatExitPattern(behavior?.exitPattern ?? null);

  const totalTrades = data.summary?.totalTradesCount ?? null;
  const winTrades = data.summary?.profitableTradesCount ?? null;

  // Overall Holdings = SPL token portfolio value in SOL (from hud, computed server-side via dex prices)
  const overallSol = hud?.currentHoldingsSol ?? null;
  const overallHoldingsText = overallSol !== null && overallSol > 0
    ? `${overallSol.toFixed(2)} SOL`
    : '—';
  const overallHoldingsColor = '#7a9ab8';

  // Badge inner SVG
  const badgeInner = SOVA_BADGE_SVG
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '');

  // ── Tile renderer (no SVG filters — librsvg doesn't support them) ──────────
  function tile(x: number, y: number, w: number, h: number, label: string, value: string, valueColor: string, sub?: string): string {
    const vLen = value.length;
    const fontSize = vLen > 12 ? 28 : vLen > 8 ? 34 : vLen > 5 ? 40 : 46;
    const uid = label.replace(/\W/g, '');
    // Gradient border: two overlapping rects — fill then a slightly inset colored stroke rect
    return `
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#0c1a2e"/>
<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="17"
      fill="none" stroke="${valueColor}" stroke-width="1" opacity="0.35"/>
<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="17"
      fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
<text id="lbl-${uid}" x="${x + w / 2}" y="${y + 38}" text-anchor="middle"
      fill="#6a8fac" font-size="12" font-weight="700" letter-spacing="2.5"
      font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(label.toUpperCase())}</text>
<text x="${x + w / 2}" y="${y + 38 + fontSize + 14}" text-anchor="middle"
      fill="${valueColor}" font-size="${fontSize}" font-weight="700"
      font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(value)}</text>
${sub ? `<text x="${x + w / 2}" y="${y + h - 16}" text-anchor="middle"
      fill="#4a7090" font-size="12" font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(sub)}</text>` : ''}`;
  }

  // ── Flag pill ──────────────────────────────────────────────────────────────
  function flagPill(x: number, y: number, label: string, active: boolean, activeColor: string): string {
    const pw = 130;
    const ph = 32;
    const border = active ? activeColor : 'rgba(255,255,255,0.07)';
    const textColor = active ? activeColor : '#4a6a88';
    const dotColor = active ? activeColor : '#2a4060';
    return `
<rect x="${x}" y="${y - ph / 2}" width="${pw}" height="${ph}" rx="16"
      fill="rgba(255,255,255,0.02)" stroke="${border}" stroke-width="1.2"/>
<circle cx="${x + 18}" cy="${y}" r="5" fill="${dotColor}"/>
<text x="${x + 32}" y="${y + 5}" fill="${textColor}" font-size="13"
      font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(label)}</text>`;
  }

  // ── Layout ─────────────────────────────────────────────────────────────────
  const contentW = W - pad * 2;

  // 4 tiles: win rate | hold time | realized pnl | overall holdings
  const tileCount = 4;
  const tileGap = 16;
  const tileH = 160;
  const tileW = Math.floor((contentW - tileGap * (tileCount - 1)) / tileCount);
  const tileTop = 330;

  const tileX = (i: number) => pad + i * (tileW + tileGap);

  // Pills row
  const pillY = tileTop + tileH + 52;
  const pill1X = pad;
  const pill2X = pad + 150;
  const pill3X = W - pad - 130 - 150;
  const pill4X = W - pad - 130;

  // Hero
  const heroY = 240;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#101e35"/>
    <stop offset="100%" stop-color="#080f1e"/>
  </linearGradient>
  <linearGradient id="hero-fill" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${accent}"/>
    <stop offset="55%" stop-color="#e8eeff"/>
    <stop offset="100%" stop-color="#5a7a9a"/>
  </linearGradient>
  <linearGradient id="border-grad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="rgba(255,255,255,0.13)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0.03)"/>
  </linearGradient>
</defs>

<!-- Canvas -->
<rect width="${W}" height="${H}" fill="#07111f"/>

<!-- Card -->
<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="30" fill="url(#bg)"/>
<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="30"
      fill="none" stroke="url(#border-grad)" stroke-width="1.5"/>

<!-- ── HEADER ───────────────────────────────────────────────────── -->
<!-- Sova badge -->
<g transform="translate(${pad}, 51) scale(${30 / 1024})">${badgeInner}</g>
<text x="${pad + 40}" y="74" fill="#7a9ab8" font-size="16" font-weight="600"
      letter-spacing="0.5" font-family="Segoe UI, system-ui, Arial, sans-serif">Sova Intel</text>

<!-- Wallet address — sits left of tier pill, more prominent -->
<text x="${W - pad - 150}" y="74" text-anchor="end" fill="#7a9ab8" font-size="14"
      font-weight="600" letter-spacing="1" font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(shortenAddress(data.walletAddress))}</text>

<!-- Tier pill -->
<rect x="${W - pad - 130}" y="40" width="120" height="32" rx="16"
      fill="${tierM.bg}" stroke="${tierM.border}" stroke-width="1.2"/>
<text x="${W - pad - 70}" y="61" text-anchor="middle" fill="${tierM.color}"
      font-size="11" font-weight="800" letter-spacing="2"
      font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(tier)}</text>

<!-- Header divider -->
<line x1="${pad}" y1="96" x2="${W - pad}" y2="96"
      stroke="rgba(255,255,255,0.05)" stroke-width="1"/>

<!-- ── HERO ─────────────────────────────────────────────────────── -->
<!-- Eyebrow label -->
<text x="${pad}" y="138" fill="#3d6080" font-size="11" font-weight="700"
      letter-spacing="3.5" font-family="Segoe UI, system-ui, Arial, sans-serif">TRADER PROFILE</text>

<!-- Trading style — big hero -->
<text x="${pad}" y="${heroY}" fill="url(#hero-fill)" font-size="80" font-weight="800"
      letter-spacing="-2.5" font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(style.label.toUpperCase())}</text>

<!-- Exit pattern sub-label right under hero -->
<text x="${pad + 4}" y="${heroY + 32}" fill="${accent}" font-size="15" font-weight="500"
      letter-spacing="0.5" font-family="Segoe UI, system-ui, Arial, sans-serif">${escapeXml(
        exit !== '—' ? `Exit style · ${exit}` : '—'
      )}</text>

<!-- ── 4 STAT TILES ──────────────────────────────────────────────── -->
${tile(tileX(0), tileTop, tileW, tileH, 'Win Rate', winRate, accent,
  winTrades !== null && totalTrades !== null ? `${winTrades} / ${totalTrades} trades` : undefined)}

${tile(tileX(1), tileTop, tileW, tileH, 'Median Hold', hold, accent)}

${tile(tileX(2), tileTop, tileW, tileH, 'Realized PnL', pnl.text, pnl.color)}

${tile(tileX(3), tileTop, tileW, tileH, 'Overall Holdings', overallHoldingsText, overallHoldingsColor)}

<!-- ── FLAG PILLS ────────────────────────────────────────────────── -->
${flagPill(pill1X, pillY, 'Bot', hud?.isBot ?? false, '#ff6b7a')}
${flagPill(pill2X, pillY, 'Whale', hud?.isWhale ?? false, '#f5d86a')}

<!-- Footer -->
<text x="${pad}" y="${H - 26}" text-anchor="start" fill="#3d6080" font-size="13" font-weight="600"
      letter-spacing="0.3" font-family="Segoe UI, system-ui, Arial, sans-serif">sova-intel.com</text>
<text x="${W - pad}" y="${H - 26}" text-anchor="end" fill="#2e4a62" font-size="12"
      font-family="Segoe UI, system-ui, Arial, sans-serif">Generated ${new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')}</text>

</svg>`;
}
