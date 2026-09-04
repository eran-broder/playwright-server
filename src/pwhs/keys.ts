import { addStoredKey, describeExpiry, listStoredKeys, removeStoredKey, keysFile } from '../relay/keys';
import { isExpired } from '../extension/pair-code';

export enum KeysSub {
  Add = 'add',
  Ls = 'ls',
  Rm = 'rm',
}

const USAGE = 'pwhs keys <add <code> [name] | ls | rm <id>>';

const add = async ([code, name = '']: string[]): Promise<void> => {
  if (!code) throw new Error(USAGE);
  const key = await addStoredKey(code, name);
  process.stdout.write(`Stored key ${key.id} for profile ${key.profileShort} (${describeExpiry(key)}) in ${keysFile()}\n`);
};

const ls = async (): Promise<void> => {
  const keys = await listStoredKeys();
  if (keys.length === 0) {
    process.stderr.write(`No stored keys (${keysFile()}).\n`);
    return;
  }
  const rows = keys.map((k) => [k.id, k.profileShort, k.name || '-', isExpired(k.expiresAt) ? 'EXPIRED' : describeExpiry(k)]);
  process.stdout.write(rows.map((r) => `${r.join('  ')}\n`).join(''));
};

const rm = async ([id]: string[]): Promise<void> => {
  if (!id) throw new Error(USAGE);
  const removed = await removeStoredKey(id);
  process.stdout.write(`Removed ${removed} key(s).\n`);
};

const COMMANDS: Record<KeysSub, (args: string[]) => Promise<void>> = {
  [KeysSub.Add]: add,
  [KeysSub.Ls]: ls,
  [KeysSub.Rm]: rm,
};

const isSub = (s: string | undefined): s is KeysSub => s !== undefined && s in COMMANDS;

export const keys = async ([sub, ...rest]: string[]): Promise<void> => {
  if (!isSub(sub)) throw new Error(USAGE);
  await COMMANDS[sub](rest);
};
