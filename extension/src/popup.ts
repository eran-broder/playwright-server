import { LockReason } from '../../src/extension/protocol';
import { CodeTtl } from './codes';
import { PopupRequest, PopupRequestType, PopupResponse } from './messages';
import type { PairCodeRecord } from './settings';

const element = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const ui = {
  browser: element<HTMLDivElement>('browser'),
  label: element<HTMLInputElement>('label'),
  saveLabel: element<HTMLButtonElement>('save-label'),
  status: element<HTMLDivElement>('status'),
  codes: element<HTMLTableSectionElement>('codes'),
  codeName: element<HTMLInputElement>('code-name'),
  codeTtl: element<HTMLSelectElement>('code-ttl'),
  mint: element<HTMLButtonElement>('mint'),
  minted: element<HTMLDivElement>('minted'),
  connect: element<HTMLButtonElement>('connect'),
  revokeAll: element<HTMLButtonElement>('revoke-all'),
  profileId: element<HTMLDivElement>('profile-id'),
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = (ms: number): string => {
  const abs = Math.abs(ms);
  if (abs < MINUTE) return 'moments';
  if (abs < HOUR) return `${Math.round(abs / MINUTE)} min`;
  if (abs < DAY) return `${Math.round(abs / HOUR)} h`;
  return `${Math.round(abs / DAY)} d`;
};

const expiryText = (expiresAt: number | null): string =>
  expiresAt === null ? 'no expiry' : `expires in ${relative(expiresAt - Date.now())}`;

const usageText = (lastUsedAt: number | null): string =>
  lastUsedAt === null ? 'never used' : `used ${relative(Date.now() - lastUsedAt)} ago`;

const LOCK_TEXT: Record<LockReason, string> = {
  [LockReason.NoKey]: 'no valid code',
  [LockReason.Expired]: 'code expired',
};

const ask = async (request: PopupRequest): Promise<PopupResponse | null> => {
  const parsed = PopupResponse.safeParse(await chrome.runtime.sendMessage(request));
  return parsed.success ? parsed.data : null;
};

const renderStatus = (r: PopupResponse): void => {
  const lines = r.connections.map((c) =>
    c.authenticated
      ? `<div class="line"><span class="dot ok"></span>Server on relay :${c.port} · ${c.attachedTabs} tab${c.attachedTabs === 1 ? '' : 's'} attached</div>`
      : `<div class="line"><span class="dot warn"></span>Server on relay :${c.port} · locked (${LOCK_TEXT[c.lockReason ?? LockReason.NoKey]})</div>`,
  );
  const searching = `<div class="line"><span class="dot"></span>Searching relay ports every 5 s</div>`;
  ui.status.innerHTML = [...lines, searching].join('');
};

const codeRow = (c: PairCodeRecord): string => `
  <tr data-id="${c.id}">
    <td><div>${c.name}</div><div class="meta">${expiryText(c.expiresAt)} · ${usageText(c.lastUsedAt)}</div></td>
    <td class="actions"><button class="small copy">Copy</button> <button class="small danger revoke">Revoke</button></td>
  </tr>`;

const renderCodes = (r: PopupResponse): void => {
  ui.codes.innerHTML = r.codes.length === 0
    ? '<tr><td class="empty">No pair codes yet. Mint one and paste it into your agent session.</td></tr>'
    : r.codes.map(codeRow).join('');
};

const renderMinted = (record: PairCodeRecord): void => {
  ui.minted.hidden = false;
  ui.minted.className = 'minted';
  ui.minted.innerHTML = `<div><strong>${record.name}</strong> · ${expiryText(record.expiresAt)}</div><code>${record.code}</code><div class="hint">Give this to your agent: <b>pwhs up --extension --pair &lt;code&gt;</b></div>`;
  navigator.clipboard.writeText(record.code).catch(() => undefined);
};

const render = (r: PopupResponse | null): void => {
  if (!r) {
    ui.status.textContent = 'Background worker did not respond. Reload the extension.';
    return;
  }
  ui.browser.textContent = `${r.brand} ${r.version}`;
  ui.label.value = r.label;
  ui.profileId.textContent = `profile ${r.profileId}`;
  renderStatus(r);
  renderCodes(r);
  if (r.minted) renderMinted(r.minted);
};

const run = async (request: PopupRequest): Promise<void> => render(await ask(request));

const codeOf = (target: EventTarget | null): PairCodeRecord['id'] | undefined =>
  (target as HTMLElement | null)?.closest('tr')?.dataset.id;

const wire = (): void => {
  ui.saveLabel.addEventListener('click', () => run({ type: PopupRequestType.SetLabel, label: ui.label.value.trim() }));
  ui.connect.addEventListener('click', () => run({ type: PopupRequestType.Connect }));
  ui.mint.addEventListener('click', () =>
    run({ type: PopupRequestType.MintCode, ttl: ui.codeTtl.value as CodeTtl, name: ui.codeName.value.trim() }),
  );
  ui.revokeAll.addEventListener('click', () => run({ type: PopupRequestType.RevokeAll }));
  ui.codes.addEventListener('click', async (event) => {
    const id = codeOf(event.target);
    const button = event.target as HTMLElement;
    if (!id) return;
    if (button.classList.contains('revoke')) return run({ type: PopupRequestType.RevokeCode, id });
    if (button.classList.contains('copy')) {
      const r = await ask({ type: PopupRequestType.Status });
      const record = r?.codes.find((c) => c.id === id);
      if (record) renderMinted(record);
    }
  });
};

wire();
run({ type: PopupRequestType.Status }).catch((err) => { ui.status.textContent = String(err); });
