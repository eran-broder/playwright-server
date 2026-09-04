import { DownloadState, ExtensionEvent, PayloadOf } from '../../src/extension/protocol';

export type Broadcast = <E extends ExtensionEvent>(event: E, payload: PayloadOf<E>) => void;

enum ChromeDownloadState {
  Complete = 'complete',
  Interrupted = 'interrupted',
}

const basename = (filePath: string): string => filePath.split(/[\\/]/).pop() ?? '';

const suggestedName = (item: chrome.downloads.DownloadItem): string => {
  const fromPath = basename(item.filename);
  if (fromPath) return fromPath;
  try {
    return basename(new URL(item.finalUrl || item.url).pathname) || 'download';
  } catch {
    return 'download';
  }
};

const toState = (state: string | undefined): DownloadState | undefined => {
  if (state === ChromeDownloadState.Complete) return DownloadState.Complete;
  if (state === ChromeDownloadState.Interrupted) return DownloadState.Interrupted;
  return undefined;
};

export const bindDownloads = (broadcast: Broadcast): void => {
  chrome.downloads.onCreated.addListener((item) => {
    broadcast(ExtensionEvent.DownloadStarted, {
      id: item.id,
      url: item.finalUrl || item.url,
      filename: suggestedName(item),
      referrer: item.referrer ?? '',
    });
  });
  chrome.downloads.onChanged.addListener((delta) => {
    const state = toState(delta.state?.current);
    if (state) broadcast(ExtensionEvent.DownloadFinished, { id: delta.id, state });
  });
};
