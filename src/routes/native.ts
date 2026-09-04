import * as fs from 'fs';
import * as path from 'path';
import { Router } from 'express';
import type { Services } from '../services';
import { asyncHandler } from './async-handler';
import {
  CdpBody,
  ClockFastForwardBody,
  ClockInstallBody,
  ClockSetBody,
  TraceStartBody,
} from '../request-schemas';

export const nativeRoutes = (s: Services): Router => {
  const r = Router();
  const bm = s.browserManager;

  r.post('/cdp', asyncHandler(async (req, res) => {
    const { method, params } = CdpBody.parse(req.body);
    res.json({ success: true, result: await bm.cdpSend(method, params) });
  }));

  r.post('/trace/start', asyncHandler(async (req, res) => {
    await bm.traceStart(TraceStartBody.parse(req.body ?? {}));
    res.json({ success: true, message: 'Tracing started' });
  }));

  r.post('/trace/stop', asyncHandler(async (_req, res) => {
    fs.mkdirSync(s.config.tracesDir, { recursive: true });
    const filepath = path.join(s.config.tracesDir, `trace-${Date.now()}.zip`);
    await bm.traceStop(filepath);
    res.json({ success: true, path: filepath });
  }));

  r.post('/clock/install', asyncHandler(async (req, res) => {
    const { time } = ClockInstallBody.parse(req.body ?? {});
    await bm.clockInstall(time);
    res.json({ success: true });
  }));

  r.post('/clock/set', asyncHandler(async (req, res) => {
    const { time } = ClockSetBody.parse(req.body);
    await bm.clockSetFixedTime(time);
    res.json({ success: true });
  }));

  r.post('/clock/fast-forward', asyncHandler(async (req, res) => {
    const { ticks } = ClockFastForwardBody.parse(req.body);
    await bm.clockFastForward(ticks);
    res.json({ success: true });
  }));

  return r;
};
