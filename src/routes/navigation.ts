import { Router } from 'express';
import type { Services } from '../services';
import { asyncHandler } from './async-handler';
import { HistoryBody, NavigateBody, SnapshotQuery } from '../request-schemas';
import { SnapshotMode } from '../types';

export const navigationRoutes = (s: Services): Router => {
  const r = Router();
  const bm = s.browserManager;

  r.post('/navigate', asyncHandler(async (req, res) => {
    const { url, waitUntil } = NavigateBody.parse(req.body);
    await bm.navigate(url, waitUntil);
    res.json({ success: true, url });
  }));

  const history = (action: 'back' | 'forward' | 'reload') =>
    asyncHandler(async (req, res) => {
      const { waitUntil } = HistoryBody.parse(req.body ?? {});
      await bm[action](waitUntil);
      res.json({ success: true, url: bm.getUrl() });
    });

  r.post('/back', history('back'));
  r.post('/forward', history('forward'));
  r.post('/reload', history('reload'));

  r.get('/url', (_req, res) => {
    res.json({ success: true, url: bm.getUrl() });
  });

  r.get('/title', asyncHandler(async (_req, res) => {
    res.json({ success: true, title: await bm.getTitle() });
  }));

  r.get('/content', asyncHandler(async (_req, res) => {
    res.json({ success: true, content: await bm.getContent() });
  }));

  r.get('/snapshot', asyncHandler(async (req, res) => {
    const q = SnapshotQuery.parse(req.query);
    const mode = q.refs ? SnapshotMode.Ai : q.mode;
    const snapshot = await bm.snapshot(q.selector, { mode, boxes: q.boxes, depth: q.depth });
    res.json({ success: true, snapshot });
  }));

  return r;
};
