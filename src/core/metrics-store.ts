import path from 'node:path';
import { mutateJsonFile, readJsonFile } from './json-file-store';

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
    await mutateJsonFile(this.filePath, createDefaultState, mutate);
  }

  private async readState(): Promise<MetricsState> {
    const parsed = await readJsonFile<Partial<MetricsState>>(this.filePath, createDefaultState);
    return {
      mentionsRead: typeof parsed.mentionsRead === 'number' ? parsed.mentionsRead : 0,
      mentionsIgnored: typeof parsed.mentionsIgnored === 'number' ? parsed.mentionsIgnored : 0,
      validOperatorTriggers: typeof parsed.validOperatorTriggers === 'number' ? parsed.validOperatorTriggers : 0,
      repliesPosted: typeof parsed.repliesPosted === 'number' ? parsed.repliesPosted : 0,
    };
  }
}

function createDefaultState(): MetricsState {
  return {
    mentionsRead: 0,
    mentionsIgnored: 0,
    validOperatorTriggers: 0,
    repliesPosted: 0,
  };
}
