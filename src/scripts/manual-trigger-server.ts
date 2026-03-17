import http from 'node:http';
import { loadEnv } from '../config/env';
import { createManualTriggerRequestHandler } from '../manual/server';

async function main(): Promise<void> {
  const env = loadEnv();
  const handler = createManualTriggerRequestHandler(env);
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.manualPort, env.manualHost, () => {
      server.off('error', reject);
      resolve();
    });
  });

  console.log(`Manual trigger UI listening at http://${env.manualHost}:${env.manualPort}${env.manualBasePath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
