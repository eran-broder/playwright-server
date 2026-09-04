import { spawn } from 'child_process';

enum Platform {
  Windows = 'win32',
  Mac = 'darwin',
}

const OPENERS: Record<string, (url: string) => [string, string[]]> = {
  [Platform.Windows]: (url) => ['cmd', ['/c', 'start', '', url]],
  [Platform.Mac]: (url) => ['open', [url]],
};

const defaultOpener = (url: string): [string, string[]] => ['xdg-open', [url]];

export const openUrl = (url: string): void => {
  const [command, args] = (OPENERS[process.platform] ?? defaultOpener)(url);
  spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
};
