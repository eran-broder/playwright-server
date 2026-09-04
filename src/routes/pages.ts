import { Router } from 'express';
import type { Services } from '../services';
import { asyncHandler } from './async-handler';
import { SwitchPageBody } from '../request-schemas';

export const pageRoutes = (s: Services): Router => {
  const r = Router();
  const bm = s.browserManager;

  r.get('/pages', asyncHandler(async (_req, res) => {
    res.json({ success: true, pages: await bm.listPages() });
  }));

  r.post('/pages/switch', asyncHandler(async (req, res) => {
    const { index } = SwitchPageBody.parse(req.body);
    await bm.switchToPage(index);
    res.json({ success: true, message: `Switched to page ${index}`, url: bm.getUrl() });
  }));

  r.post('/pages/switch-latest', asyncHandler(async (_req, res) => {
    await bm.switchToLatestPage();
    res.json({ success: true, message: 'Switched to latest page', url: bm.getUrl() });
  }));

  return r;
};
