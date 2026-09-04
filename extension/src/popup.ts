import { PopupRequestType, PopupResponse } from './messages';
import { loadSettings, saveSettings } from './settings';

const element = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const labelInput = element<HTMLInputElement>('label');
const tokenInput = element<HTMLInputElement>('token');
const statusBox = element<HTMLDivElement>('status');
const idBox = element<HTMLDivElement>('id');

const ask = async (type: PopupRequestType): Promise<PopupResponse | null> => {
  const parsed = PopupResponse.safeParse(await chrome.runtime.sendMessage({ type }));
  return parsed.success ? parsed.data : null;
};

const render = (response: PopupResponse | null, hasToken: boolean): void => {
  if (!hasToken) {
    statusBox.textContent = 'Paste the pairing token from `pwhs token`, then Save.';
    return;
  }
  if (!response) {
    statusBox.textContent = 'Background worker did not respond.';
    return;
  }
  idBox.textContent = `instance ${response.instanceId}`;
  statusBox.textContent = response.connections.length === 0
    ? 'No pwhs server found. Start one with `pwhs up --extension`.'
    : `Connected to relay port${response.connections.length > 1 ? 's' : ''}: ${response.connections.map((c) => c.port).join(', ')}`;
};

const refresh = async (type: PopupRequestType): Promise<void> => {
  const settings = await loadSettings();
  render(await ask(type), settings.token.length > 0);
};

const init = async (): Promise<void> => {
  const settings = await loadSettings();
  labelInput.value = settings.label;
  tokenInput.value = settings.token;
  element<HTMLButtonElement>('save').addEventListener('click', async () => {
    await saveSettings({ label: labelInput.value.trim(), token: tokenInput.value.trim() });
    await refresh(PopupRequestType.Connect);
  });
  element<HTMLButtonElement>('connect').addEventListener('click', () => refresh(PopupRequestType.Connect));
  await refresh(PopupRequestType.Status);
};

init().catch((err) => { statusBox.textContent = String(err); });
