import { PAIR_PAIRED_ATTRIBUTE, PAIR_PATH, PAIR_STATUS_ID, relayPortCandidates } from '../../src/extension/protocol';
import { saveSettings } from './settings';

const TOKEN_PARAM = 'token';
const LABEL_PARAM = 'label';

const setStatus = (text: string): void => {
  const el = document.getElementById(PAIR_STATUS_ID);
  if (el) el.textContent = text;
};

const readPairing = (): { token: string; label: string } | null => {
  if (location.pathname !== PAIR_PATH) return null;
  if (!relayPortCandidates().includes(Number(location.port))) return null;
  const token = new URLSearchParams(location.hash.slice(1)).get(TOKEN_PARAM);
  if (!token) return null;
  return { token, label: new URLSearchParams(location.search).get(LABEL_PARAM) ?? '' };
};

const pair = async (): Promise<void> => {
  const pairing = readPairing();
  if (!pairing) return;
  document.documentElement.setAttribute(PAIR_PAIRED_ATTRIBUTE, '1');
  await saveSettings(pairing);
  setStatus(`Paired this profile as "${pairing.label || 'unlabeled'}". You can close this tab.`);
};

pair().catch((err) => setStatus(`Pairing failed: ${String(err)}`));
