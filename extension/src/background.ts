import { DebuggerHub } from './debugger-hub';
import { Discovery } from './discovery';
import { bindDownloads } from './downloads';
import { PopupRequest, PopupRequestType, PopupResponse } from './messages';
import { affectsPairing, ensureInstanceId } from './settings';

const PROBE_ALARM = 'pwhs-probe';
const ALARM_PERIOD_MINUTES = 0.5;
const PROBE_INTERVAL_MS = 3_000;

const hub = new DebuggerHub();
const discovery = new Discovery(hub);

const respondStatus = async (): Promise<PopupResponse> => ({
  instanceId: await ensureInstanceId(),
  connections: discovery.status(),
});

const handlePopup = async (request: PopupRequest): Promise<PopupResponse> => {
  if (request.type === PopupRequestType.Connect) await discovery.probeAll();
  return respondStatus();
};

const wire = (): void => {
  bindDownloads((event, payload) => discovery.broadcast(event, payload));
  chrome.alarms.create(PROBE_ALARM, { periodInMinutes: ALARM_PERIOD_MINUTES });
  chrome.alarms.onAlarm.addListener(() => { discovery.probeAll().catch(() => undefined); });
  chrome.runtime.onStartup.addListener(() => { discovery.probeAll().catch(() => undefined); });
  chrome.runtime.onInstalled.addListener(() => { discovery.probeAll().catch(() => undefined); });
  chrome.storage.onChanged.addListener((changes) => {
    if (affectsPairing(changes)) discovery.reset().catch(() => undefined);
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const parsed = PopupRequest.safeParse(message);
    if (!parsed.success) return false;
    handlePopup(parsed.data).then(sendResponse).catch(() => sendResponse(null));
    return true;
  });
  setInterval(() => { discovery.probeAll().catch(() => undefined); }, PROBE_INTERVAL_MS);
};

wire();
console.log(`[pwhs] ${new Date().toISOString()} service worker started`);
discovery.probeAll().catch(() => undefined);
