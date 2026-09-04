import { createHash } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

export const DATA_PATH_PREFIX = '/data/';
const DATA_URL_PATTERN = /^data:([^,]*?)(;base64)?,([\s\S]*)$/;
const DEFAULT_MIME = 'text/plain;charset=US-ASCII';
const KEY_LENGTH = 16;
const MAX_ENTRIES = 200;

interface Served {
  mime: string;
  body: Buffer;
}

const decodePercent = (data: string): Buffer => {
  try {
    return Buffer.from(decodeURIComponent(data), 'utf-8');
  } catch {
    return Buffer.from(data, 'utf-8');
  }
};

const parseDataUrl = (url: string): Served => {
  const match = DATA_URL_PATTERN.exec(url);
  if (!match) throw new Error(`Malformed data URL: ${url.slice(0, 60)}`);
  const [, mime, base64, data] = match;
  return {
    mime: mime || DEFAULT_MIME,
    body: base64 ? Buffer.from(data, 'base64') : decodePercent(data),
  };
};

const keyFor = (url: string): string =>
  createHash('sha256').update(url).digest('hex').slice(0, KEY_LENGTH);

export const isDataUrl = (url: string): boolean => url.startsWith('data:');

export class DataUrlStore {
  private readonly entries = new Map<string, Served>();

  constructor(private readonly baseUrl: () => string) {}

  publish(dataUrl: string): string {
    const key = keyFor(dataUrl);
    this.entries.delete(key);
    this.entries.set(key, parseDataUrl(dataUrl));
    this.evictOldest();
    return `${this.baseUrl()}${DATA_PATH_PREFIX}${key}`;
  }

  serve(req: IncomingMessage, res: ServerResponse): boolean {
    const url = req.url ?? '';
    if (!url.startsWith(DATA_PATH_PREFIX)) return false;
    const entry = this.entries.get(url.slice(DATA_PATH_PREFIX.length));
    if (!entry) return false;
    res.writeHead(200, { 'Content-Type': entry.mime, 'Cache-Control': 'no-store' });
    res.end(entry.body);
    return true;
  }

  private evictOldest(): void {
    const excess = this.entries.size - MAX_ENTRIES;
    [...this.entries.keys()].slice(0, Math.max(0, excess)).forEach((key) => this.entries.delete(key));
  }
}
