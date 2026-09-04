import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';

export const LOG_FILE_NAME = 'server.log';

type ConsoleMethod = 'log' | 'error' | 'warn';

const MIRRORED: ConsoleMethod[] = ['log', 'error', 'warn'];

export const mirrorConsoleToFile = (workdir: string): string => {
  const file = path.join(workdir, LOG_FILE_NAME);
  const stream = fs.createWriteStream(file, { flags: 'a' });
  MIRRORED.forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]): void => {
      original(...args);
      stream.write(`${new Date().toISOString()} ${format(...args)}\n`);
    };
  });
  return file;
};
