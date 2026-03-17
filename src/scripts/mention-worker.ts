import { loadEnv } from '../config/env';
import { MentionWorker } from '../mentions/worker';

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.sovaIntelApiKey) {
    throw new Error('SOVA_INTEL_API_KEY is required for mention polling.');
  }

  const worker = new MentionWorker(env);
  await worker.runForever();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
