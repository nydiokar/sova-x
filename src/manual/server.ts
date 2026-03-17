import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { processTrigger } from '../app/process-trigger';
import { loadEnv, type SovaXEnv } from '../config/env';
import { SdkIntelClient } from '../intel/client';
import { DexscreenerTokenMetadataClient } from '../metadata/client';
import { renderSvgToPngBuffer } from '../render/png';
import { parseXPostUrl } from '../core/x-post-url';
import { XMediaClient } from '../x/media-client';
import { XClient } from '../x/x-client';
import { isManualViewerAllowed, resolveManualViewer } from './auth';
import { ManualRunStore } from './run-store';

type TriggerResponse = {
  runId: string;
  status: 'previewed' | 'posted';
  tweetId: string;
  normalizedTweetUrl: string;
  mint: string;
  replyText: string;
  previewImageUrl: string;
  outputJsonPath: string;
  previewToken?: string;
  postedReplyId?: string;
};

type PreviewRun = {
  runId: string;
  previewToken: string;
  tweetId: string;
  normalizedTweetUrl: string;
  mint: string;
  replyText: string;
  png: Buffer;
  outputJsonPath: string;
};

const previewRuns: Map<string, PreviewRun> = new Map();

export function createManualTriggerRequestHandler(env: SovaXEnv = loadEnv()) {
  const basePath: string = normalizeBasePath(env.manualBasePath);
  const runStore = new ManualRunStore(env.outputDir);

  return async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method: string = req.method ?? 'GET';
    const url: URL = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const pathname: string = url.pathname;

    if (pathname === '/') {
      redirect(res, basePath);
      return;
    }

    if (!pathname.startsWith(basePath)) {
      respondText(res, 404, 'Not found.');
      return;
    }

    const viewer = resolveManualViewer(req);
    if (!isManualViewerAllowed(viewer, env)) {
      respondJson(res, 403, {
        error: 'Manual trigger access requires dashboard-authenticated internal user headers for an allowed operator.',
      });
      return;
    }

    if (method === 'GET' && pathname === basePath) {
      respondHtml(res, renderIndexHtml(basePath, viewer?.name ?? viewer?.email ?? viewer?.id ?? 'operator'));
      return;
    }

    if (method === 'GET' && pathname.startsWith(`${basePath}/preview/`)) {
      const runId: string = path.basename(pathname, '.png');
      const run = findPreviewRunByRunId(runId);
      if (!run) {
        respondText(res, 404, 'Preview not found.');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(run.png);
      return;
    }

    if (method === 'GET' && pathname === `${basePath}/api/runs`) {
      const runs = await runStore.listRuns();
      respondJson(res, 200, { runs });
      return;
    }

    if (method === 'POST' && pathname === `${basePath}/api/trigger`) {
      try {
        const body = await readJsonBody(req);
        const result = await runTrigger({
          env,
          runStore,
          tweetUrl: expectString(body.tweetUrl, 'tweetUrl'),
          mint: expectString(body.mint, 'mint'),
          mode: body.mode === 'post' ? 'post' : 'preview',
          previewToken: readOptionalString(body.previewToken),
          confirmPost: body.confirmPost === true,
          basePath,
        });
        respondJson(res, 200, result);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        respondJson(res, 400, { error: message });
      }
      return;
    }

    respondText(res, 404, 'Not found.');
  };
}

async function runTrigger(params: {
  env: SovaXEnv;
  runStore: ManualRunStore;
  tweetUrl: string;
  mint: string;
  mode: 'preview' | 'post';
  previewToken: string | null;
  confirmPost: boolean;
  basePath: string;
}): Promise<TriggerResponse> {
  if (!params.env.sovaIntelApiKey) {
    throw new Error('SOVA_INTEL_API_KEY is required in sova-x/.env');
  }

  if (params.mode === 'post') {
    if (!params.confirmPost) {
      throw new Error('Posting requires explicit confirmation after preview.');
    }

    if (!params.previewToken) {
      throw new Error('Posting requires a preview token from a successful preview.');
    }

    const storedRun = await params.runStore.findByPreviewToken(params.previewToken);
    if (!storedRun) {
      throw new Error('Preview token is invalid or expired.');
    }

    const previewRun = previewRuns.get(params.previewToken);
    if (!previewRun || previewRun.runId !== storedRun.runId) {
      throw new Error('Preview asset is unavailable. Generate a fresh preview before posting.');
    }

    const normalizedTweetUrl: string | null = normalizeTweetUrl(params.tweetUrl);
    if (!normalizedTweetUrl || storedRun.normalizedTweetUrl !== normalizedTweetUrl || storedRun.mint !== params.mint.trim()) {
      throw new Error('Preview token does not match the requested tweet URL and mint.');
    }

    await params.runStore.markPosting(storedRun.runId);

    let postedReplyId: string;
    try {
      postedReplyId = await postReply({
        env: params.env,
        replyText: previewRun.replyText,
        replyToTweetId: previewRun.tweetId,
        png: previewRun.png,
      });
    } catch (error: unknown) {
      const message: string = toErrorMessage(error);
      await params.runStore.markFailed(storedRun.runId, message);
      throw error;
    }

    await params.runStore.markPosted(storedRun.runId, postedReplyId);

    return {
      runId: storedRun.runId,
      status: 'posted',
      tweetId: storedRun.targetTweetId,
      normalizedTweetUrl: storedRun.normalizedTweetUrl,
      mint: storedRun.mint,
      replyText: storedRun.replyText,
      previewImageUrl: `${params.basePath}/preview/${storedRun.runId}.png`,
      outputJsonPath: storedRun.outputJsonPath ?? '',
      postedReplyId,
    };
  }

  const intelClient = new SdkIntelClient({
    baseUrl: params.env.sovaIntelBaseUrl,
    apiKey: params.env.sovaIntelApiKey,
    pollIntervalMs: params.env.pollIntervalMs,
  });
  const metadataClient = new DexscreenerTokenMetadataClient();
  const triggerResult = await processTrigger({
    tweetUrl: params.tweetUrl,
    mint: params.mint,
    intelClient,
    metadataClient,
    topN: params.env.defaultTopN,
  });
  if (triggerResult.status !== 'ready') {
    throw new Error(triggerResult.reason);
  }

  if (await params.runStore.hasDuplicateTargetMint(triggerResult.tweetId, triggerResult.mint)) {
    throw new Error('A manual run for this target tweet and mint already exists.');
  }

  const png: Buffer = await renderSvgToPngBuffer(triggerResult.socialCardSvg);
  const runId: string = randomUUID();
  const previewToken: string = randomUUID();
  const previewImagePath: string = path.join(params.env.outputDir, `manual-trigger-${runId}.png`);
  await fs.mkdir(params.env.outputDir, { recursive: true });
  await fs.writeFile(previewImagePath, png);
  const outputJsonPath: string = await writeRunArtifacts({
    outputDir: params.env.outputDir,
    runId,
    tweetId: triggerResult.tweetId,
    normalizedTweetUrl: triggerResult.normalizedTweetUrl,
    mint: triggerResult.mint,
    replyText: triggerResult.replyText,
  });

  previewRuns.set(previewToken, {
    runId,
    previewToken,
    tweetId: triggerResult.tweetId,
    normalizedTweetUrl: triggerResult.normalizedTweetUrl,
    mint: triggerResult.mint,
    replyText: triggerResult.replyText,
    png,
    outputJsonPath,
  });
  await params.runStore.createPreviewRun({
    runId,
    targetTweetId: triggerResult.tweetId,
    normalizedTweetUrl: triggerResult.normalizedTweetUrl,
    mint: triggerResult.mint,
    replyText: triggerResult.replyText,
    previewToken,
    previewImagePath,
    outputJsonPath,
  });

  return {
    runId,
    status: 'previewed',
    tweetId: triggerResult.tweetId,
    normalizedTweetUrl: triggerResult.normalizedTweetUrl,
    mint: triggerResult.mint,
    replyText: triggerResult.replyText,
    previewImageUrl: `${params.basePath}/preview/${runId}.png`,
    outputJsonPath,
    previewToken,
  };
}

async function postReply(params: {
  env: SovaXEnv;
  replyText: string;
  replyToTweetId: string;
  png: Buffer;
}): Promise<string> {
  const auth = buildPostAuth(params.env);
  const xClient = new XClient(params.env.xApiBaseUrl, auth);
  const mediaClient = new XMediaClient(params.env.xApiBaseUrl, auth);
  const uploaded = await mediaClient.uploadPng(params.png);
  const post = await xClient.createPost({
    text: params.replyText,
    replyToTweetId: params.replyToTweetId,
    mediaIds: [uploaded.mediaId],
  });
  return post.id;
}

function buildPostAuth(env: SovaXEnv):
  | { kind: 'bearer'; token: string }
  | {
      kind: 'oauth1';
      credentials: {
        consumerKey: string;
        consumerSecret: string;
        accessToken: string;
        accessTokenSecret: string;
      };
    } {
  if (env.xConsumerKey && env.xConsumerSecret && env.xAccessToken && env.xAccessTokenSecret) {
    return {
      kind: 'oauth1',
      credentials: {
        consumerKey: env.xConsumerKey,
        consumerSecret: env.xConsumerSecret,
        accessToken: env.xAccessToken,
        accessTokenSecret: env.xAccessTokenSecret,
      },
    };
  }

  if (env.xOAuth2AccessToken) {
    return { kind: 'bearer', token: env.xOAuth2AccessToken };
  }

  throw new Error('Posting requires X_OAUTH2_ACCESS_TOKEN or the OAuth 1.0a credential set in sova-x/.env');
}

async function writeRunArtifacts(params: {
  outputDir: string;
  runId: string;
  tweetId: string;
  normalizedTweetUrl: string;
  mint: string;
  replyText: string;
}): Promise<string> {
  await fs.mkdir(params.outputDir, { recursive: true });
  const jsonPath: string = path.join(params.outputDir, `manual-trigger-${params.runId}.json`);
  await fs.writeFile(jsonPath, JSON.stringify({
    runId: params.runId,
    tweetId: params.tweetId,
    normalizedTweetUrl: params.normalizedTweetUrl,
    mint: params.mint,
    replyText: params.replyText,
    generatedAtIso: new Date().toISOString(),
  }, null, 2), 'utf8');
  return jsonPath;
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody: string = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody) as Record<string, unknown>;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed: string = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function respondHtml(res: http.ServerResponse, html: string): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function respondText(res: http.ServerResponse, statusCode: number, text: string): void {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function respondJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

function normalizeBasePath(input: string): string {
  const trimmed: string = input.trim();
  if (!trimmed || trimmed === '/') {
    return '/manual-trigger';
  }

  return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') : `/${trimmed.replace(/\/+$/, '')}`;
}

function findPreviewRunByRunId(runId: string): PreviewRun | null {
  for (const run of previewRuns.values()) {
    if (run.runId === runId) {
      return run;
    }
  }

  return null;
}

function normalizeTweetUrl(input: string): string | null {
  const parsed = parseXPostUrl(input);
  return parsed?.normalizedUrl ?? null;
}

function renderIndexHtml(basePath: string, viewerLabel: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sova X Manual Trigger</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #08111d;
      --panel: #0d1727;
      --border: #1d2a40;
      --text: #f3f7ff;
      --muted: #92a7c7;
      --accent: #7bc86c;
      --accent-2: #8bbcff;
      --danger: #ff9b8c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(139,188,255,0.18), transparent 28%),
        linear-gradient(180deg, #06101b 0%, #08111d 100%);
      color: var(--text);
    }
    main {
      max-width: 1040px;
      margin: 48px auto;
      padding: 0 20px;
    }
    .panel {
      background: rgba(13, 23, 39, 0.96);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    }
    .eyebrow {
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    h1 { margin: 0 0 8px; font-size: 32px; }
    p { margin: 0 0 20px; color: var(--muted); line-height: 1.5; }
    label { display: block; margin: 0 0 8px; font-weight: 600; }
    input, textarea, button {
      font: inherit;
    }
    input {
      width: 100%;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: #08111d;
      color: var(--text);
      margin-bottom: 18px;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      margin-bottom: 20px;
    }
    button {
      border: 0;
      border-radius: 14px;
      padding: 12px 18px;
      cursor: pointer;
      color: #06101b;
      font-weight: 700;
    }
    button.preview { background: var(--accent-2); }
    button.post { background: var(--accent); }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .confirm {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      color: var(--muted);
    }
    .confirm input {
      width: auto;
      margin: 0;
    }
    .warning {
      color: var(--danger);
      margin-top: -8px;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #08111d;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      color: var(--muted);
      min-height: 120px;
      overflow: auto;
    }
    img {
      display: block;
      width: 100%;
      margin-top: 20px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: #08111d;
    }
    .history {
      margin-top: 28px;
      border-top: 1px solid var(--border);
      padding-top: 24px;
    }
    .history h2 {
      margin: 0 0 14px;
      font-size: 18px;
    }
    .history-list {
      display: grid;
      gap: 10px;
    }
    .history-item {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px 16px;
      background: #08111d;
    }
    .history-item strong {
      display: block;
      margin-bottom: 6px;
    }
    .history-item code {
      color: var(--accent-2);
    }
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <div class="eyebrow">Internal Only</div>
      <h1>Sova X Manual Trigger</h1>
      <p>Signed in as ${escapeHtml(viewerLabel)}. Preview first, then explicitly confirm before posting a live reply.</p>
      <label for="tweetUrl">Target X Post URL</label>
      <input id="tweetUrl" placeholder="https://x.com/user/status/1234567890123456789">
      <label for="mint">Token Mint</label>
      <input id="mint" placeholder="9xQeWvG816bUx9EPfEZkLqN2YtY1YfB9F9r3uL6kP7z">
      <div class="actions">
        <button class="preview" id="previewButton">Preview Reply</button>
        <button class="post" id="postButton" disabled>Post Reply</button>
      </div>
      <label class="confirm">
        <input id="confirmPost" type="checkbox">
        <span>I reviewed the preview and want to post this reply live.</span>
      </label>
      <p class="warning">Live posting stays disabled until a preview completes and you confirm the action.</p>
      <pre id="result">No run yet.</pre>
      <img id="preview" alt="Reply preview" hidden>
      <section class="history">
        <h2>Run History</h2>
        <div id="history" class="history-list">Loading...</div>
      </section>
    </section>
  </main>
  <script>
    const resultEl = document.getElementById('result');
    const previewEl = document.getElementById('preview');
    const tweetUrlEl = document.getElementById('tweetUrl');
    const mintEl = document.getElementById('mint');
    const confirmPostEl = document.getElementById('confirmPost');
    const previewButtonEl = document.getElementById('previewButton');
    const postButtonEl = document.getElementById('postButton');
    const historyEl = document.getElementById('history');
    let previewToken = null;

    function syncPostButton() {
      postButtonEl.disabled = !(previewToken && confirmPostEl.checked);
    }

    function clearPreviewState() {
      previewToken = null;
      confirmPostEl.checked = false;
      syncPostButton();
    }

    tweetUrlEl.addEventListener('input', clearPreviewState);
    mintEl.addEventListener('input', clearPreviewState);
    confirmPostEl.addEventListener('change', syncPostButton);

    async function run(mode) {
      resultEl.textContent = mode === 'preview' ? 'Generating preview...' : 'Posting live reply...';
      previewButtonEl.disabled = true;
      postButtonEl.disabled = true;
      if (mode === 'preview') {
        previewEl.hidden = true;
        previewEl.removeAttribute('src');
      }

      const response = await fetch('${basePath}/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetUrl: tweetUrlEl.value,
          mint: mintEl.value,
          mode,
          previewToken,
          confirmPost: confirmPostEl.checked,
        }),
      });

      const payload = await response.json();
      resultEl.textContent = JSON.stringify(payload, null, 2);

      if (response.ok && mode === 'preview') {
        previewToken = payload.previewToken || null;
        if (payload.previewImageUrl) {
          previewEl.src = payload.previewImageUrl + '?t=' + Date.now();
          previewEl.hidden = false;
        }
      }

      if (!response.ok && mode === 'preview') {
        clearPreviewState();
      }

      if (response.ok && mode === 'post') {
        previewToken = null;
        confirmPostEl.checked = false;
      }

      previewButtonEl.disabled = false;
      syncPostButton();
      await loadHistory();
    }

    function renderHistory(runs) {
      if (!runs.length) {
        historyEl.textContent = 'No persisted manual runs yet.';
        return;
      }

      historyEl.innerHTML = runs.map((run) => {
        const error = run.errorMessage ? '<div>Error: ' + escapeHtml(run.errorMessage) + '</div>' : '';
        const reply = run.postedReplyId ? '<div>Reply: <code>' + escapeHtml(run.postedReplyId) + '</code></div>' : '';
        return [
          '<article class="history-item">',
          '<strong>' + escapeHtml(run.status.toUpperCase()) + ' · ' + escapeHtml(run.mint) + '</strong>',
          '<div>Tweet: <code>' + escapeHtml(run.targetTweetId) + '</code></div>',
          '<div>Created: ' + escapeHtml(run.createdAtIso) + '</div>',
          reply,
          error,
          '</article>'
        ].join('');
      }).join('');
    }

    async function loadHistory() {
      const response = await fetch('${basePath}/api/runs');
      const payload = await response.json();
      if (!response.ok) {
        historyEl.textContent = payload.error || 'Failed to load run history.';
        return;
      }

      renderHistory(payload.runs || []);
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    previewButtonEl.addEventListener('click', () => run('preview'));
    postButtonEl.addEventListener('click', () => run('post'));
    void loadHistory();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
