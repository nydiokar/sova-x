import fs from 'node:fs/promises';
import path from 'node:path';

const chains: Map<string, Promise<void>> = new Map();

export async function mutateJsonFile<T>(
  filePath: string,
  readDefault: () => T,
  mutate: (state: T) => void,
): Promise<void> {
  const previous: Promise<void> = chains.get(filePath) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  chains.set(filePath, previous.then(() => current));

  await previous;
  const lockPath = `${filePath}.lock`;
  await acquireLock(lockPath);
  try {
    const state: T = await readJsonFile(filePath, readDefault);
    mutate(state);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
  } finally {
    await fs.rm(lockPath, { force: true });
    release();
    if (chains.get(filePath) === current) {
      chains.delete(filePath);
    }
  }
}

export async function readJsonFile<T>(filePath: string, readDefault: () => T): Promise<T> {
  try {
    const raw: string = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return readDefault();
    }

    throw error;
  }
}

async function acquireLock(lockPath: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.close();
      return;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      await sleep(25 * (attempt + 1));
    }
  }

  throw new Error(`Timed out waiting for file lock: ${lockPath}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
