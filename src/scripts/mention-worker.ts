import { loadEnv } from '../config/env';
import { MentionWorker } from '../mentions/worker';

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.sovaIntelApiKey) {
    throw new Error('SOVA_INTEL_API_KEY is required for mention polling.');
  }

  const worker = new MentionWorker(env);
  const requestStop = (signal: NodeJS.Signals): void => {
    console.log(`[mention-worker] received ${signal}, stopping after the current cycle`);
    worker.requestStop();
  };
  process.once('SIGINT', requestStop);
  process.once('SIGTERM', requestStop);
  await worker.runForever();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
