import { PROBE_INTERVAL_MS } from '../../src/extension/protocol';
import { CodeTtl, TTL_MS, listCodes, mintCode, revokeAllCodes, revokeCode } from './codes';
import { DebuggerHub } from './debugger-hub';
import { Discovery } from './discovery';
import { bindDownloads } from './downloads';
import { describeInstance } from './instance-info';
import { ensureOffscreenKeepalive } from './keepalive';
import { KeepaliveMessage, PopupRequest, PopupRequestType, PopupResponse } from './messages';
import { affectsPairing, ensureProfileId, loadSettings, saveSettings } from './settings';

const PROBE_ALARM = 'pwhs-probe';
const ALARM_PERIOD_MINUTES = 0.5;

const hub = new DebuggerHub();
const discovery = new Discovery(hub);

const probe = (): void => { discovery.probeAll().catch(() => undefined); };

const status = async (): Promise<PopupResponse> => {
  const settings = await loadSettings();
  const instance = await describeInstance(await ensureProfileId(), settings.label);
  return {
    profileId: instance.id,
    label: settings.label,
    brand: instance.brand,
    version: instance.version,
    connections: discovery.status(),
    codes: await listCodes(),
  };
};

const ACTIONS: { [T in PopupRequestType]: (request: Extract<PopupRequest, { type: T }>) => Promise<Partial<PopupResponse>> } = {
  [PopupRequestType.Status]: async () => ({}),
  [PopupRequestType.Connect]: async () => { await discovery.probeAll(); return {}; },
  [PopupRequestType.MintCode]: async ({ ttl, name }) => ({ minted: await mintCode(TTL_MS[ttl], name) }),
  [PopupRequestType.RevokeCode]: async ({ id }) => { await revokeCode(id); return {}; },
  [PopupRequestType.RevokeAll]: async () => { await revokeAllCodes(); return {}; },
  [PopupRequestType.SetLabel]: async ({ label }) => { await saveSettings({ label }); return {}; },
};

const handlePopup = async (request: PopupRequest): Promise<PopupResponse> => {
  const action = ACTIONS[request.type] as (r: PopupRequest) => Promise<Partial<PopupResponse>>;
  const extra = await action(request);
  return { ...(await status()), ...extra };
};

const wire = (): void => {
  bindDownloads((event, payload) => discovery.broadcast(event, payload));
  chrome.alarms.create(PROBE_ALARM, { periodInMinutes: ALARM_PERIOD_MINUTES });
  chrome.alarms.onAlarm.addListener(probe);
  chrome.runtime.onStartup.addListener(probe);
  chrome.runtime.onInstalled.addListener(probe);
  chrome.storage.onChanged.addListener((changes) => {
    if (affectsPairing(changes)) discovery.reset().catch(() => undefined);
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (KeepaliveMessage.safeParse(message).success) return false;
    const parsed = PopupRequest.safeParse(message);
    if (!parsed.success) return false;
    handlePopup(parsed.data).then(sendResponse).catch(() => sendResponse(null));
    return true;
  });
  setInterval(probe, PROBE_INTERVAL_MS);
};

const exposeTestingHooks = (): void => {
  Object.assign(globalThis, {
    pwhs: {
      mintCode: (ttl: CodeTtl | number | null, name = 'test') =>
        mintCode(typeof ttl === 'string' ? TTL_MS[ttl] : ttl, name).then((r) => r.code),
    },
  });
};

wire();
exposeTestingHooks();
ensureOffscreenKeepalive().catch(() => undefined);
console.log(`[pwhs] ${new Date().toISOString()} service worker started`);
probe();
