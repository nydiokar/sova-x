import fs from 'node:fs/promises';
import path from 'node:path';

export type ManualRunStatus = 'previewed' | 'posting' | 'posted' | 'failed';

export type ManualRunRecord = {
  runId: string;
  triggerMode: 'manual';
  targetTweetId: string;
  normalizedTweetUrl: string;
  mint: string;
  status: ManualRunStatus;
  replyText: string;
  previewToken: string | null;
  previewImagePath: string | null;
  outputJsonPath: string | null;
  postedReplyId: string | null;
  errorMessage: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type ManualRunStoreState = {
  runs: ManualRunRecord[];
};

export class ManualRunStore {
  private readonly filePath: string;

  constructor(outputDir: string) {
    this.filePath = path.join(outputDir, 'manual-runs.json');
  }

  async listRuns(): Promise<ManualRunRecord[]> {
    const state = await this.readState();
    return [...state.runs].sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
  }

  async findByPreviewToken(previewToken: string): Promise<ManualRunRecord | null> {
    const state = await this.readState();
    return state.runs.find((run) => run.previewToken === previewToken) ?? null;
  }

  async findByRunId(runId: string): Promise<ManualRunRecord | null> {
    const state = await this.readState();
    return state.runs.find((run) => run.runId === runId) ?? null;
  }

  async hasDuplicateTargetMint(targetTweetId: string, mint: string): Promise<boolean> {
    const state = await this.readState();
    return state.runs.some((run) =>
      run.targetTweetId === targetTweetId &&
      run.mint === mint &&
      (run.status === 'previewed' || run.status === 'posting' || run.status === 'posted'),
    );
  }

  async createPreviewRun(input: {
    runId: string;
    targetTweetId: string;
    normalizedTweetUrl: string;
    mint: string;
    replyText: string;
    previewToken: string;
    previewImagePath: string;
    outputJsonPath: string;
  }): Promise<ManualRunRecord> {
    const nowIso: string = new Date().toISOString();
    const record: ManualRunRecord = {
      runId: input.runId,
      triggerMode: 'manual',
      targetTweetId: input.targetTweetId,
      normalizedTweetUrl: input.normalizedTweetUrl,
      mint: input.mint,
      status: 'previewed',
      replyText: input.replyText,
      previewToken: input.previewToken,
      previewImagePath: input.previewImagePath,
      outputJsonPath: input.outputJsonPath,
      postedReplyId: null,
      errorMessage: null,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    await this.mutateState((state) => {
      state.runs.push(record);
    });

    return record;
  }

  async markPosting(runId: string): Promise<ManualRunRecord | null> {
    return this.updateRun(runId, (record) => {
      record.status = 'posting';
      record.errorMessage = null;
    });
  }

  async markPosted(runId: string, postedReplyId: string): Promise<ManualRunRecord | null> {
    return this.updateRun(runId, (record) => {
      record.status = 'posted';
      record.postedReplyId = postedReplyId;
      record.previewToken = null;
      record.errorMessage = null;
    });
  }

  async markFailed(runId: string, errorMessage: string): Promise<ManualRunRecord | null> {
    return this.updateRun(runId, (record) => {
      record.status = 'failed';
      record.errorMessage = errorMessage;
    });
  }

  private async updateRun(
    runId: string,
    mutate: (record: ManualRunRecord) => void,
  ): Promise<ManualRunRecord | null> {
    let updated: ManualRunRecord | null = null;
    await this.mutateState((state) => {
      const record = state.runs.find((item) => item.runId === runId);
      if (!record) {
        return;
      }

      mutate(record);
      record.updatedAtIso = new Date().toISOString();
      updated = { ...record };
    });
    return updated;
  }

  private async mutateState(mutate: (state: ManualRunStoreState) => void): Promise<void> {
    const state = await this.readState();
    mutate(state);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private async readState(): Promise<ManualRunStoreState> {
    try {
      const raw: string = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ManualRunStoreState>;
      return {
        runs: Array.isArray(parsed.runs) ? parsed.runs as ManualRunRecord[] : [],
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { runs: [] };
      }

      throw error;
    }
  }
}
