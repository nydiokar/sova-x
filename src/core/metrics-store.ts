import fs from 'node:fs/promises';
import path from 'node:path';

export type MetricsState = {
  mentionsRead: number;
  mentionsIgnored: number;
  validOperatorTriggers: number;
  repliesPosted: number;
};

export class MetricsStore {
  private readonly filePath: string;

  constructor(outputDir: string) {
    this.filePath = path.join(outputDir, 'metrics.json');
  }

  async getState(): Promise<MetricsState> {
    return this.readState();
  }

  async increment(key: keyof MetricsState, amount = 1): Promise<MetricsState> {
    let updated!: MetricsState;
    await this.mutateState((state) => {
      state[key] += amount;
      updated = { ...state };
    });
    return updated;
  }

  private async mutateState(mutate: (state: MetricsState) => void): Promise<void> {
    const state = await this.readState();
    mutate(state);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private async readState(): Promise<MetricsState> {
    try {
      const raw: string = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<MetricsState>;
      return {
        mentionsRead: typeof parsed.mentionsRead === 'number' ? parsed.mentionsRead : 0,
        mentionsIgnored: typeof parsed.mentionsIgnored === 'number' ? parsed.mentionsIgnored : 0,
        validOperatorTriggers: typeof parsed.validOperatorTriggers === 'number' ? parsed.validOperatorTriggers : 0,
        repliesPosted: typeof parsed.repliesPosted === 'number' ? parsed.repliesPosted : 0,
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          mentionsRead: 0,
          mentionsIgnored: 0,
          validOperatorTriggers: 0,
          repliesPosted: 0,
        };
      }

      throw error;
    }
  }
}
