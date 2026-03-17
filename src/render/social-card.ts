import type { HolderDistributionSummary } from '../core/summary';
import { formatUtcTimestamp } from '../core/summary';
import { SOVA_BADGE_SVG } from '../assets/sova-badge';

export async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function shortenMint(mint: string): string {
  if (mint.length <= 16) return mint;
  return `${mint.slice(0, 6)}...${mint.slice(-6)}`;
}

function formatAxisValue(value: number): string {
  if (value === 0) return '0%';
  if (Number.isInteger(value)) return `${value}%`;
  return `${value.toFixed(1)}%`;
}

export function renderSocialCardSvg(summary: HolderDistributionSummary, tokenImageDataUri?: string | null): string {
  const width: number = 1200;
  const height: number = 675;
  const padding: number = 56;
  const innerLeft: number = padding;
  const innerRight: number = width - padding;

  // Header zone
  const iconCx: number = innerLeft + 34;
  const iconCy: number = 76;
  const iconR: number = 30;

  // Subtitle zone
  const subtitleY: number = 138;
  const dividerY: number = 156;

  // Chart zone
  const chartLeft: number = 110;
  const chartTop: number = 182;
  const chartWidth: number = innerRight - chartLeft - 8;
  const chartHeight: number = 300;
  const maxSupply: number = Math.max(1, ...summary.buckets.map((bucket) => bucket.supplyPercent));
  const stepCount: number = 4;
  const barGap: number = 14;
  const barWidth: number = Math.floor((chartWidth - (summary.buckets.length - 1) * barGap) / summary.buckets.length);

  // Footer zone
  const footerY: number = height - 36;

  const gridLines: string[] = [];
  for (let index = 0; index <= stepCount; index += 1) {
    const y: number = chartTop + (chartHeight / stepCount) * index;
    const value: number = maxSupply - (maxSupply / stepCount) * index;
    gridLines.push(`
      <line x1="${chartLeft}" y1="${y}" x2="${chartLeft + chartWidth}" y2="${y}" stroke="rgba(163,178,212,0.12)" stroke-width="1" />
      <text x="${chartLeft - 14}" y="${y + 5}" text-anchor="end" fill="#5c7396" font-size="18" font-family="Segoe UI, Arial, sans-serif">${formatAxisValue(value)}</text>
    `);
  }

  const bars: string[] = summary.buckets.map((bucket, index) => {
    const x: number = chartLeft + index * (barWidth + barGap);
    const heightPercent: number = bucket.supplyPercent / maxSupply;
    const barHeight: number = Math.max(0, Math.round(chartHeight * heightPercent));
    const y: number = chartTop + chartHeight - barHeight;
    const labelY: number = chartTop + chartHeight + 36;
    const timeframeY: number = labelY + 22;
    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="14" fill="${bucket.color}" />
      <text x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle" fill="#f4f7ff" font-size="19" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${escapeXml(bucket.label)}</text>
      <text x="${x + barWidth / 2}" y="${timeframeY}" text-anchor="middle" fill="#5c7396" font-size="14" font-family="Segoe UI, Arial, sans-serif">${escapeXml(bucket.timeframe)}</text>
    `;
  });

  // Token icon with proper clipPath for librsvg compatibility
  // Use pre-fetched data URI so sharp/librsvg can render the image (it cannot fetch external URLs)
  const clipId = 'token-icon-clip';
  const resolvedImageUri = tokenImageDataUri ?? null;
  const iconMarkup: string = resolvedImageUri
    ? `<defs><clipPath id="${clipId}"><circle cx="${iconCx}" cy="${iconCy}" r="${iconR}" /></clipPath></defs>
       <circle cx="${iconCx}" cy="${iconCy}" r="${iconR}" fill="#0f1729" stroke="#2a3552" stroke-width="2" />
       <image href="${escapeXml(resolvedImageUri)}" x="${iconCx - iconR}" y="${iconCy - iconR}" width="${iconR * 2}" height="${iconR * 2}" clip-path="url(#${clipId})" />`
    : `<circle cx="${iconCx}" cy="${iconCy}" r="${iconR}" fill="#1f2b46" />
       <text x="${iconCx}" y="${iconCy + 8}" text-anchor="middle" fill="#f4f7ff" font-size="18" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${escapeXml(summary.tokenSymbol.slice(0, 3).toUpperCase())}</text>`;

  // Sova badge in header (top-right, vertically centered with icon)
  const badgeSize: number = 34;
  const brandTextX: number = innerRight;
  const brandTextY: number = iconCy + 8;
  const badgeX: number = brandTextX - 164;
  const badgeY: number = iconCy - badgeSize / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#07111f" />
  <rect width="${width}" height="${height}" rx="36" fill="#07111f" />
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="28" fill="#0b1729" stroke="#16243d" stroke-width="2" />

  <!-- Header: token info left, branding right -->
  ${iconMarkup}
  <text x="${iconCx + iconR + 16}" y="${iconCy - 4}" fill="#f4f7ff" font-size="36" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${escapeXml(summary.tokenSymbol)}</text>
  <text x="${iconCx + iconR + 16}" y="${iconCy + 24}" fill="#5c7396" font-size="17" font-family="Segoe UI, Arial, sans-serif">${escapeXml(summary.mint)}</text>

  <g transform="translate(${badgeX}, ${badgeY}) scale(${badgeSize / 1024})">
    ${SOVA_BADGE_SVG.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet">', '').replace('</svg>', '')}
  </g>
  <text x="${brandTextX}" y="${brandTextY}" text-anchor="end" fill="#8ea4c4" font-size="22" font-weight="600" font-family="Segoe UI, Arial, sans-serif">Sova Intel</text>

  <!-- Subtitle: context left, fresh supply right -->
  <text x="${innerLeft}" y="${subtitleY}" fill="#8ea4c4" font-size="20" font-family="Segoe UI, Arial, sans-serif">Holding patterns of top ${summary.topN} holders</text>
  <text x="${innerRight}" y="${subtitleY}" text-anchor="end" fill="#8fd17c" font-size="20" font-weight="700" font-family="Segoe UI, Arial, sans-serif">Fresh supply ${Math.round(summary.freshSupplyPercent)}%</text>
  <line x1="${innerLeft}" y1="${dividerY}" x2="${innerRight}" y2="${dividerY}" stroke="rgba(163,178,212,0.15)" stroke-width="1" />

  <!-- Chart -->
  ${gridLines.join('')}
  ${bars.join('')}

  <!-- Footer: timestamp -->
  <text x="${innerRight}" y="${footerY}" text-anchor="end" fill="#3d5470" font-size="14" font-family="Segoe UI, Arial, sans-serif">Generated ${formatUtcTimestamp(summary.generatedAtIso)}</text>
</svg>`;
}
