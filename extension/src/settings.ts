import { z } from 'zod';

export const PairCodeRecord = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  createdAt: z.number(),
  expiresAt: z.number().nullable(),
  lastUsedAt: z.number().nullable(),
});
export type PairCodeRecord = z.infer<typeof PairCodeRecord>;

export const Settings = z.object({
  profileId: z.string().default(''),
  label: z.string().default(''),
  codes: z.array(PairCodeRecord).default([]),
});
export type Settings = z.infer<typeof Settings>;

const KEYS = Object.keys(Settings.shape);

export const loadSettings = async (): Promise<Settings> =>
  Settings.parse(await chrome.storage.local.get(KEYS));

export const saveSettings = (patch: Partial<Settings>): Promise<void> =>
  chrome.storage.local.set(patch);

const createProfileId = async (): Promise<string> => {
  const settings = await loadSettings();
  if (settings.profileId) return settings.profileId;
  const profileId = crypto.randomUUID();
  await saveSettings({ profileId });
  return profileId;
};

let profileIdPromise: Promise<string> | null = null;

export const ensureProfileId = (): Promise<string> => {
  profileIdPromise ??= createProfileId();
  return profileIdPromise;
};

export const PAIRING_KEYS: ReadonlyArray<keyof Settings> = ['label', 'codes'];

export const affectsPairing = (changes: Record<string, unknown>): boolean =>
  PAIRING_KEYS.some((key) => key in changes);
