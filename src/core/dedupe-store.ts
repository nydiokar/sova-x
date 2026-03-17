import fs from 'node:fs/promises';
import path from 'node:path';

type DedupeEntry = {
  key: string;
  ownerId: string;
  createdAtIso: string;
};

type DedupeState = {
  entries: DedupeEntry[];
};

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
    const state = await this.readState();
    mutate(state);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private async readState(): Promise<DedupeState> {
    try {
      const raw: string = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DedupeState>;
      return {
        entries: Array.isArray(parsed.entries) ? parsed.entries as DedupeEntry[] : [],
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { entries: [] };
      }

      throw error;
    }
  }
}

function buildTargetMintKey(targetTweetId: string, mint: string): string {
  return `${targetTweetId}:${mint}`;
}
