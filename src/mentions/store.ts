import fs from 'node:fs/promises';
import path from 'node:path';

export type MentionRunStatus = 'ignored' | 'failed' | 'posted';

export type MentionRunRecord = {
  mentionId: string;
  targetTweetId: string;
  authorId: string;
  authorUsername: string | null;
  mint: string | null;
  status: MentionRunStatus;
  reason: string | null;
  replyTweetId: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type MentionStoreState = {
  lastSeenMentionId: string | null;
  mentions: MentionRunRecord[];
};

export class MentionStore {
  private readonly filePath: string;

  constructor(outputDir: string) {
    this.filePath = path.join(outputDir, 'mention-state.json');
  }

  async getLastSeenMentionId(): Promise<string | null> {
    const state = await this.readState();
    return state.lastSeenMentionId;
  }

  async setLastSeenMentionId(mentionId: string): Promise<void> {
    await this.mutateState((state) => {
      state.lastSeenMentionId = mentionId;
    });
  }

  async hasMention(mentionId: string): Promise<boolean> {
    const state = await this.readState();
    return state.mentions.some((mention) => mention.mentionId === mentionId);
  }

  async createMention(input: {
    mentionId: string;
    targetTweetId: string;
    authorId: string;
    authorUsername: string | null;
    mint: string | null;
    status: MentionRunStatus;
    reason: string | null;
    replyTweetId?: string | null;
  }): Promise<void> {
    const nowIso: string = new Date().toISOString();
    await this.mutateState((state) => {
      state.mentions.push({
        mentionId: input.mentionId,
        targetTweetId: input.targetTweetId,
        authorId: input.authorId,
        authorUsername: input.authorUsername,
        mint: input.mint,
        status: input.status,
        reason: input.reason,
        replyTweetId: input.replyTweetId ?? null,
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
      });
    });
  }

  private async mutateState(mutate: (state: MentionStoreState) => void): Promise<void> {
    const state = await this.readState();
    mutate(state);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  private async readState(): Promise<MentionStoreState> {
    try {
      const raw: string = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<MentionStoreState>;
      return {
        lastSeenMentionId: typeof parsed.lastSeenMentionId === 'string' ? parsed.lastSeenMentionId : null,
        mentions: Array.isArray(parsed.mentions) ? parsed.mentions as MentionRunRecord[] : [],
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          lastSeenMentionId: null,
          mentions: [],
        };
      }

      throw error;
    }
  }
}
