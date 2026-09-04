import express, { Router } from 'express';
import type { Services } from '../services';
import { asyncHandler } from './async-handler';
import { ScreenshotBody } from '../request-schemas';

export const captureRoutes = (s: Services): Router => {
  const r = Router();
  const shots = s.screenshotManager;

  r.post('/screenshot', asyncHandler(async (req, res) => {
    const { name, fullPage } = ScreenshotBody.parse(req.body ?? {});
    const screenshotName = name || shots.generateName();
    await s.browserManager.screenshot(shots.getFilepath(screenshotName), fullPage);
    res.json({ success: true, ...shots.getResult(screenshotName) });
  }));

  r.get('/screenshot/:name', (req, res) => {
    const { name } = req.params;
    if (shots.exists(name)) {
      res.sendFile(shots.getFilepath(name));
    } else {
      res.status(404).json({ success: false, error: 'Screenshot not found' });
    }
  });

  r.get('/screenshots', (_req, res) => {
    res.json({ success: true, screenshots: shots.list() });
  });

  r.use('/static/screenshots', express.static(shots.getDirectory()));

  return r;
};
