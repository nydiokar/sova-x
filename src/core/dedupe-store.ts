import path from 'node:path';
import { mutateJsonFile, readJsonFile } from './json-file-store';

type DedupeEntry = {
  key: string;
  ownerId: string;
  createdAtIso: string;
};

type DedupeState = {
  entries: DedupeEntry[];
};

const DEDUPE_TTL_MS: number = 30 * 24 * 60 * 60 * 1000;
const MAX_DEDUPE_ENTRIES: number = 5000;

export class DedupeStore {
  private readonly filePath: string;

  constructor(outputDir: string) {
    this.filePath = path.join(outputDir, 'dedupe-state.json');
  }

  async claimTargetMint(targetTweetId: string, mint: string, ownerId: string): Promise<boolean> {
    const key: string = buildTargetMintKey(targetTweetId, mint);
    let claimed = false;
    await this.mutateState((state) => {
      const existing = state.entries.find((entry) => entry.key === key);
      if (existing) {
        claimed = existing.ownerId === ownerId;
        return;
      }

      state.entries.push({
        key,
        ownerId,
        createdAtIso: new Date().toISOString(),
      });
      claimed = true;
    });
    return claimed;
  }

  private async mutateState(mutate: (state: DedupeState) => void): Promise<void> {
    await mutateJsonFile(this.filePath, createDefaultState, (state) => {
      pruneEntries(state);
      mutate(state);
      pruneEntries(state);
    });
  }

  private async readState(): Promise<DedupeState> {
    const parsed = await readJsonFile<Partial<DedupeState>>(this.filePath, createDefaultState);
    const state: DedupeState = {
      entries: Array.isArray(parsed.entries) ? parsed.entries as DedupeEntry[] : [],
    };
    pruneEntries(state);
    return state;
  }
}

function buildTargetMintKey(targetTweetId: string, mint: string): string {
  return `${targetTweetId}:${mint}`;
}

function createDefaultState(): DedupeState {
  return { entries: [] };
}

function pruneEntries(state: DedupeState): void {
  const cutoffMs: number = Date.now() - DEDUPE_TTL_MS;
  state.entries = state.entries.filter((entry) => Date.parse(entry.createdAtIso) >= cutoffMs);
  if (state.entries.length <= MAX_DEDUPE_ENTRIES) {
    return;
  }

  state.entries = [...state.entries]
    .sort((left, right) => left.createdAtIso.localeCompare(right.createdAtIso))
    .slice(-MAX_DEDUPE_ENTRIES);
}
