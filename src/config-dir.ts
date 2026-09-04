import * as os from 'os';
import * as path from 'path';

export const configDir = (): string => {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'pwhs');
  }
  const xdg = process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state');
  return path.join(xdg, 'pwhs');
};
