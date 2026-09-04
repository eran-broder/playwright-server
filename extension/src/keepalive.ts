const OFFSCREEN_URL = 'offscreen.html';
const JUSTIFICATION = 'Keeps the relay discovery loop alive so paired servers connect within seconds';

export const ensureOffscreenKeepalive = async (): Promise<void> => {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: JUSTIFICATION,
  });
};
