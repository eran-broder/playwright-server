import type { IncomingMessage, ServerResponse } from 'http';
import { PAIR_PATH, PAIR_PAIRED_ATTRIBUTE, PAIR_STATUS_ID } from '../extension/protocol';

const RELOAD_INTERVAL_MS = 3000;

const PAGE = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>pwhs pairing</title>
    <style>
      body { font: 15px system-ui, sans-serif; max-width: 520px; margin: 80px auto; color: #222; }
      h1 { font-size: 20px; }
      #${PAIR_STATUS_ID} { padding: 14px; background: #f4f4f4; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h1>pwhs bridge pairing</h1>
    <div id="${PAIR_STATUS_ID}">Waiting for the pwhs bridge extension… If this text does not change within a few seconds, load or reload the extension in this browser profile (chrome://extensions → Load unpacked / reload). This page retries on its own.</div>
    <script>
      setTimeout(() => {
        if (!document.documentElement.hasAttribute('${PAIR_PAIRED_ATTRIBUTE}')) location.reload();
      }, ${RELOAD_INTERVAL_MS});
    </script>
  </body>
</html>`;

export const pairUrl = (baseUrl: string, label: string, token: string): string =>
  `${baseUrl}${PAIR_PATH}?label=${encodeURIComponent(label)}#token=${token}`;

export const servePairPage = (req: IncomingMessage, res: ServerResponse): boolean => {
  if (!req.url?.startsWith(PAIR_PATH)) return false;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(PAGE);
  return true;
};
