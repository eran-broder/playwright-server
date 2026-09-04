import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { configDir } from '../config-dir';
import { LockReason } from '../extension/protocol';
import { PairCode, belongsTo, codeIdOf, isExpired, parsePairCode } from '../extension/pair-code';

const StoredKey = z.object({
  code: z.string(),
  name: z.string().default(''),
  addedAt: z.number(),
});
type StoredKey = z.infer<typeof StoredKey>;
const StoredKeys = z.array(StoredKey);

export interface ResolvedKey extends PairCode, StoredKey {
  id: string;
}

export interface KeyMatch {
  key?: ResolvedKey;
  reason?: LockReason;
}

export const keysFile = (): string => path.join(configDir(), 'keys.json');

const readStored = (): StoredKey[] => {
  const file = keysFile();
  if (!fs.existsSync(file)) return [];
  const parsed = StoredKeys.safeParse(JSON.parse(fs.readFileSync(file, 'utf-8')));
  return parsed.success ? parsed.data : [];
};

const writeStored = (keys: StoredKey[]): void => {
  const file = keysFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 });
};

export const resolveKey = async (stored: StoredKey): Promise<ResolvedKey> => {
  const parsed = parsePairCode(stored.code);
  return { ...stored, ...parsed, id: await codeIdOf(parsed.secret) };
};

export const describeExpiry = (key: PairCode): string =>
  key.expiresAt === null ? 'never expires' : `expires ${new Date(key.expiresAt).toISOString()}`;

export const assertLive = (key: ResolvedKey): ResolvedKey => {
  if (isExpired(key.expiresAt)) {
    throw new Error(`Pair code ${key.id} expired at ${new Date(key.expiresAt ?? 0).toISOString()}. Mint a new one in the extension popup.`);
  }
  return key;
};

const inlineKey = (code: string): StoredKey => ({ code, name: 'inline', addedAt: Date.now() });

export class KeyStore {
  private constructor(private readonly keys: ResolvedKey[]) {}

  static async load(inlineCodes: string[] = []): Promise<KeyStore> {
    const inline = await Promise.all(inlineCodes.map((c) => resolveKey(inlineKey(c))));
    inline.forEach(assertLive);
    const stored = await Promise.all(readStored().map(resolveKey));
    return new KeyStore([...inline, ...stored]);
  }

  list(): ResolvedKey[] {
    return this.keys;
  }

  match(profileId: string, codeIds: string[]): KeyMatch {
    const offered = new Set(codeIds);
    const candidates = this.keys.filter((k) => belongsTo(k, profileId) && offered.has(k.id));
    const key = candidates.find((k) => !isExpired(k.expiresAt));
    if (key) return { key };
    return { reason: candidates.length > 0 ? LockReason.Expired : LockReason.NoKey };
  }
}

export const addStoredKey = async (code: string, name: string): Promise<ResolvedKey> => {
  const key = assertLive(await resolveKey({ code: code.trim(), name, addedAt: Date.now() }));
  writeStored([...readStored().filter((k) => k.code !== key.code), { code: key.code, name, addedAt: key.addedAt }]);
  return key;
};

export const listStoredKeys = (): Promise<ResolvedKey[]> => Promise.all(readStored().map(resolveKey));

export const removeStoredKey = async (idPrefix: string): Promise<number> => {
  const keys = await listStoredKeys();
  const keep = keys.filter((k) => !k.id.startsWith(idPrefix.toUpperCase()));
  writeStored(keep.map(({ code, name, addedAt }) => ({ code, name, addedAt })));
  return keys.length - keep.length;
};
