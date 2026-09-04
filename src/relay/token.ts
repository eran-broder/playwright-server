import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { configDir } from '../config-dir';

const TOKEN_BYTES = 32;

export const tokenFile = (): string => path.join(configDir(), 'token');

export const loadOrCreateToken = (): string => {
  const file = tokenFile();
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf-8').trim();
    if (existing) return existing;
  }
  const token = randomBytes(TOKEN_BYTES).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token, { mode: 0o600 });
  return token;
};
