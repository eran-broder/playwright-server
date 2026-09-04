import * as path from 'path';
import { Router } from 'express';
import type { Services } from '../services';
import { LOG_FILE_NAME } from '../log-file';

export const statusRoutes = (s: Services): Router => {
  const r = Router();

  r.get('/status', (_req, res) => {
    const status = s.browserManager.getStatus();
    res.json({
      server: 'running',
      browser: status.hasBrowser,
      page: status.hasPage,
      currentUrl: status.currentUrl,
      mode: status.mode ?? null,
      profile: status.profile ?? null,
      relayPort: status.relayPort ?? null,
      recording: s.activityRecorder.getState(),
      screenshotsDir: s.screenshotManager.getDirectory(),
      scriptsDir: s.config.scriptsDir,
      logFile: path.join(process.cwd(), LOG_FILE_NAME),
    });
  });

  return r;
};
