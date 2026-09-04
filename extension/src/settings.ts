import { z } from 'zod';

export const Settings = z.object({
  token: z.string().default(''),
  label: z.string().default(''),
  instanceId: z.string().default(''),
});
export type Settings = z.infer<typeof Settings>;

const KEYS = Object.keys(Settings.shape);

export const loadSettings = async (): Promise<Settings> =>
  Settings.parse(await chrome.storage.local.get(KEYS));

export const saveSettings = (patch: Partial<Settings>): Promise<void> =>
  chrome.storage.local.set(patch);

const createInstanceId = async (): Promise<string> => {
  const settings = await loadSettings();
  if (settings.instanceId) return settings.instanceId;
  const instanceId = crypto.randomUUID();
  await saveSettings({ instanceId });
  return instanceId;
};

let instanceIdPromise: Promise<string> | null = null;

export const ensureInstanceId = (): Promise<string> => {
  instanceIdPromise ??= createInstanceId();
  return instanceIdPromise;
};

export const PAIRING_KEYS: ReadonlyArray<keyof Settings> = ['token', 'label'];

export const affectsPairing = (changes: Record<string, unknown>): boolean =>
  PAIRING_KEYS.some((key) => key in changes);
