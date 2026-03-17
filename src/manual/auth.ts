import type http from 'node:http';
import type { SovaXEnv } from '../config/env';

export type ManualViewer = {
  id: string | null;
  email: string | null;
  name: string | null;
};

export function resolveManualViewer(req: http.IncomingMessage): ManualViewer | null {
  const id: string | null = readHeader(req, 'x-sova-user-id');
  const email: string | null = normalizeEmail(readHeader(req, 'x-sova-user-email'));
  const name: string | null = readHeader(req, 'x-sova-user-name');

  if (!id && !email) {
    return null;
  }

  return { id, email, name };
}

export function isManualViewerAllowed(viewer: ManualViewer | null, env: SovaXEnv): boolean {
  if (!viewer) {
    return false;
  }

  const hasUserIdPolicy: boolean = env.manualAllowedUserIds.length > 0;
  const hasEmailPolicy: boolean = env.manualAllowedUserEmails.length > 0;
  if (!hasUserIdPolicy && !hasEmailPolicy) {
    return false;
  }

  if (viewer.id && env.manualAllowedUserIds.includes(viewer.id)) {
    return true;
  }

  if (viewer.email && env.manualAllowedUserEmails.includes(viewer.email)) {
    return true;
  }

  return false;
}

function readHeader(req: http.IncomingMessage, name: string): string | null {
  const raw = req.headers[name];
  const value: string | undefined = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed: string = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.toLowerCase();
}
