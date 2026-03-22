import fs from 'node:fs/promises';
import path from 'node:path';
import { SovaIntelClient } from '@sova-intel/sdk';
import { loadEnv } from '../config/env';
import { renderWalletProfileCardSvg } from '../render/wallet-profile-card';
import { renderSvgToPngBuffer } from '../render/png';

async function main(): Promise<void> {
  const env = loadEnv();
  const walletAddress = process.argv[2]?.trim();

  if (!walletAddress) throw new Error('Usage: pnpm test:wallet-card <WALLET_ADDRESS>');
  if (!env.sovaIntelApiKey) throw new Error('SOVA_INTEL_API_KEY is required in sova-x/.env');

  const client = new SovaIntelClient({
    baseUrl: env.sovaIntelBaseUrl,
    auth: { kind: 'apikey', apiKey: env.sovaIntelApiKey },
  });

  console.log(`Fetching wallet profile for ${walletAddress}...`);
  const profile = await client.getWalletProfile(walletAddress);

  const svg = renderWalletProfileCardSvg(profile);
  const png = await renderSvgToPngBuffer(svg);

  await fs.mkdir(env.outputDir, { recursive: true });
  const slug = walletAddress.slice(0, 8);
  const svgPath = path.join(env.outputDir, `wallet-profile-${slug}.svg`);
  const pngPath = path.join(env.outputDir, `wallet-profile-${slug}.png`);

  await fs.writeFile(svgPath, svg, 'utf8');
  await fs.writeFile(pngPath, png);

  console.log(`\nWrote ${svgPath}`);
  console.log(`Wrote ${pngPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
