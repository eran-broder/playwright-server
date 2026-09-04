import { codeIdOf, isExpired, mintPairCode, parsePairCode } from '../../src/extension/pair-code';
import { PairCodeRecord, ensureProfileId, loadSettings, saveSettings } from './settings';

export enum CodeTtl {
  Hour = 'hour',
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Never = 'never',
}

const HOUR_MS = 60 * 60 * 1000;

export const TTL_MS: Record<CodeTtl, number | null> = {
  [CodeTtl.Hour]: HOUR_MS,
  [CodeTtl.Day]: 24 * HOUR_MS,
  [CodeTtl.Week]: 7 * 24 * HOUR_MS,
  [CodeTtl.Month]: 30 * 24 * HOUR_MS,
  [CodeTtl.Never]: null,
};

const expiryFor = (ttlMs: number | null, now: number): number | null =>
  ttlMs === null ? null : now + ttlMs;

const live = (codes: PairCodeRecord[], now = Date.now()): PairCodeRecord[] =>
  codes.filter((c) => !isExpired(c.expiresAt, now));

export const listCodes = async (): Promise<PairCodeRecord[]> => live((await loadSettings()).codes);

export const mintCode = async (ttlMs: number | null, name: string): Promise<PairCodeRecord> => {
  const now = Date.now();
  const profileId = await ensureProfileId();
  const code = mintPairCode(profileId, expiryFor(ttlMs, now));
  const record: PairCodeRecord = {
    id: await codeIdOf(parsePairCode(code).secret),
    name: name || `code ${new Date(now).toLocaleDateString()}`,
    code,
    createdAt: now,
    expiresAt: expiryFor(ttlMs, now),
    lastUsedAt: null,
  };
  const settings = await loadSettings();
  await saveSettings({ codes: [...live(settings.codes, now), record] });
  return record;
};

export const revokeCode = async (id: string): Promise<void> => {
  const settings = await loadSettings();
  await saveSettings({ codes: settings.codes.filter((c) => c.id !== id) });
};

export const revokeAllCodes = (): Promise<void> => saveSettings({ codes: [] });

export const findLiveCode = async (id: string): Promise<PairCodeRecord | undefined> =>
  (await listCodes()).find((c) => c.id === id);

export const markUsed = async (id: string): Promise<void> => {
  const settings = await loadSettings();
  const codes = settings.codes.map((c) => (c.id === id ? { ...c, lastUsedAt: Date.now() } : c));
  await chrome.storage.local.set({ codes });
};
