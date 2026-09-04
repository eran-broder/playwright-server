import { WorkerMessageType } from './messages';

const KEEPALIVE_PING_MS = 20_000;

setInterval(() => {
  chrome.runtime.sendMessage({ type: WorkerMessageType.Keepalive }).catch(() => undefined);
}, KEEPALIVE_PING_MS);
